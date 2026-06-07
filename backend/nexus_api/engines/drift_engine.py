"""
Drift Detection Engine.
Algorithms: PSI, KL Divergence, KS approximation, Page-Hinkley test.
Baseline window: days 15-30; Current window: last 14 days.
"""
import math
import datetime
from typing import Dict, List, Any, Tuple


PSI_STABLE  = 0.10
PSI_MONITOR = 0.20


def _psi_severity(psi: float) -> str:
    if psi < PSI_STABLE:
        return "STABLE"
    if psi < PSI_MONITOR:
        return "MONITOR"
    return "DRIFT_DETECTED"


def _psi_binary(p_base: float, p_curr: float) -> float:
    b  = max(p_base, 1e-6)
    c  = max(p_curr, 1e-6)
    b2 = max(1 - b, 1e-6)
    c2 = max(1 - c, 1e-6)
    return (c - b) * math.log(c / b) + (c2 - b2) * math.log(c2 / b2)


def _kl_binary(p_base: float, p_curr: float) -> float:
    b  = max(p_base, 1e-6)
    c  = max(p_curr, 1e-6)
    b2 = max(1 - b, 1e-6)
    c2 = max(1 - c, 1e-6)
    return b * math.log(b / c) + b2 * math.log(b2 / c2)


def _window_rates(transactions: List[Dict], days_ago_start: int, days_ago_end: int) -> Dict[str, float]:
    now = datetime.date.today()
    start = (now - datetime.timedelta(days=days_ago_start)).isoformat()
    end   = (now - datetime.timedelta(days=days_ago_end)).isoformat()
    txs = [t for t in transactions if end <= t["event_date"] <= start]
    n   = max(len(txs), 1)
    return {
        "n":               len(txs),
        "cmra_rate":       sum(1 for t in txs if t["cmra_flag"]) / n,
        "pbsa_rate":       sum(1 for t in txs if t["pbsa_flag"]) / n,
        "pobox_rate":      sum(1 for t in txs if t["pobox_flag"]) / n,
        "koec0039_rate":   sum(1 for t in txs if t["fault_code"] == "KOEC0039") / n,
        "comm_error_rate": sum(1 for t in txs if t["comm_error"]) / n,
        "doc_fail_rate":   sum(1 for t in txs if t["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED") / n,
        "pass_rate":       sum(1 for t in txs if t["final_result"] == "IDENTITY_VERIFIED") / n,
    }


VARIABLE_LABELS = {
    "cmra_rate":       "CMRA Rate",
    "pbsa_rate":       "PBSA Rate",
    "pobox_rate":      "POBox Rate",
    "koec0039_rate":   "KOEC0039 Rate",
    "comm_error_rate": "Comm Error Rate",
    "doc_fail_rate":   "Doc Fail Rate",
    "pass_rate":       "Verification Rate",
}


def compute_drift_report(transactions: List[Dict]) -> List[Dict[str, Any]]:
    baseline = _window_rates(transactions, 30, 14)
    current  = _window_rates(transactions, 14, 0)

    results = []
    for key, label in VARIABLE_LABELS.items():
        b   = baseline[key]
        c   = current[key]
        psi = abs(_psi_binary(b, c))
        kl  = abs(_kl_binary(b, c))
        ks  = abs(b - c)
        sev = _psi_severity(psi)
        results.append({
            "variable":      key,
            "label":         label,
            "psi":           round(psi, 4),
            "kl":            round(kl, 4),
            "ks_stat":       round(ks, 4),
            "severity":      sev,
            "baseline_rate": round(b * 100, 2),
            "current_rate":  round(c * 100, 2),
            "trend":         round((c - b) * 100, 2),
            "alert":         sev == "DRIFT_DETECTED",
        })
    return sorted(results, key=lambda x: -x["psi"])


def compute_drift_heatmap(transactions: List[Dict]) -> List[Dict[str, Any]]:
    by_date: Dict[str, List] = {}
    for tx in transactions:
        by_date.setdefault(tx["event_date"], []).append(tx)

    dates = sorted(by_date.keys())[-14:]
    cutoff = (datetime.date.today() - datetime.timedelta(days=14)).isoformat()
    baseline_txs = [t for t in transactions if t["event_date"] < cutoff]
    bn = max(len(baseline_txs), 1)

    def rates(txs: List, n: int) -> Dict[str, float]:
        return {
            "cmra_rate":       sum(1 for t in txs if t["cmra_flag"]) / n,
            "pbsa_rate":       sum(1 for t in txs if t["pbsa_flag"]) / n,
            "koec0039_rate":   sum(1 for t in txs if t["fault_code"] == "KOEC0039") / n,
            "comm_error_rate": sum(1 for t in txs if t["comm_error"]) / n,
            "doc_fail_rate":   sum(1 for t in txs if t["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED") / n,
            "pass_rate":       sum(1 for t in txs if t["final_result"] == "IDENTITY_VERIFIED") / n,
        }

    base_rates = rates(baseline_txs, bn)
    cells = []
    for date in dates:
        day_txs = by_date.get(date, [])
        dn = max(len(day_txs), 1)
        day_rates = rates(day_txs, dn)
        for var in base_rates:
            psi = abs(_psi_binary(base_rates[var], day_rates[var]))
            cells.append({"variable": var, "date": date, "psi": round(psi, 3), "severity": _psi_severity(psi)})
    return cells


def compute_page_hinkley(transactions: List[Dict]) -> Dict[str, Any]:
    by_date: Dict[str, Tuple[int, int]] = {}
    for tx in transactions:
        d = tx["event_date"]
        tot, ver = by_date.get(d, (0, 0))
        tot += 1
        if tx["final_result"] == "IDENTITY_VERIFIED":
            ver += 1
        by_date[d] = (tot, ver)

    stream = [{"date": d, "rate": round(ver / tot * 100, 1)}
              for d, (tot, ver) in sorted(by_date.items()) if tot > 0]

    if len(stream) < 2:
        return {"stream": stream, "change_point": None, "rate_before": 0, "rate_after": 0, "delta": 0}

    init_n = max(1, len(stream) // 3)
    mu_0   = sum(s["rate"] for s in stream[:init_n]) / init_n

    cum, M, change_idx = 0.0, 0.0, None
    delta_ph, threshold = 0.5, 10.0
    for i, s in enumerate(stream):
        cum += s["rate"] - mu_0 - delta_ph
        M = max(M, cum)
        if M - cum > threshold:
            change_idx = i
            break

    cp = stream[change_idx]["date"] if change_idx is not None else None
    before = [s["rate"] for s in (stream[:change_idx] if change_idx else stream[:len(stream)//2])]
    after  = [s["rate"] for s in (stream[change_idx:] if change_idx else stream[len(stream)//2:])]
    avg = lambda arr: sum(arr) / len(arr) if arr else 0.0

    return {
        "stream":       stream,
        "change_point": cp,
        "rate_before":  round(avg(before), 1),
        "rate_after":   round(avg(after), 1),
        "delta":        round(avg(after) - avg(before), 1),
    }


def compute_drift_timeline(transactions: List[Dict], variable: str) -> List[Dict[str, Any]]:
    by_date: Dict[str, List] = {}
    for tx in transactions:
        by_date.setdefault(tx["event_date"], []).append(tx)

    dates = sorted(by_date.keys())
    if len(dates) < 2:
        return []

    def get_rate(txs: List, n: int) -> float:
        if variable == "cmra_rate":
            return sum(1 for t in txs if t["cmra_flag"]) / n
        if variable == "pbsa_rate":
            return sum(1 for t in txs if t["pbsa_flag"]) / n
        if variable == "koec0039_rate":
            return sum(1 for t in txs if t["fault_code"] == "KOEC0039") / n
        if variable == "comm_error_rate":
            return sum(1 for t in txs if t["comm_error"]) / n
        if variable == "doc_fail_rate":
            return sum(1 for t in txs if t["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED") / n
        return sum(1 for t in txs if t["final_result"] == "IDENTITY_VERIFIED") / n

    baseline_txs = [t for d in dates[:7] for t in by_date.get(d, [])]
    bn = max(len(baseline_txs), 1)
    base_rate = get_rate(baseline_txs, bn)

    result = []
    for date in dates[7:]:
        day_txs = by_date.get(date, [])
        dn = max(len(day_txs), 1)
        curr = get_rate(day_txs, dn)
        psi  = abs(_psi_binary(base_rate, curr))
        result.append({"date": date, "psi": round(psi, 3), "severity": _psi_severity(psi)})
    return result
