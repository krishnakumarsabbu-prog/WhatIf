"""
Sankey Engine — DAG path mining + flow aggregation.
Algorithm: O(N*S) — counts transitions between IDPF service nodes.
"""
from collections import defaultdict
from typing import List, Dict, Any

NODES = [
    "REQUEST_IN", "DOC_VERIFY", "FACE_SCAN",
    "GSA_CHECK", "PDMA_CHECK", "RISK_EVAL",
    "IDENTITY_VERIFIED", "IDENTITY_NOT_VERIFIED"
]
NODE_INDEX = {n: i for i, n in enumerate(NODES)}


def compute_sankey(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build D3-Sankey compatible nodes/links from transaction records."""
    link_counts: Dict[tuple, Dict[str, int]] = defaultdict(lambda: {"total": 0, "pass": 0, "fail": 0})
    node_stats:  Dict[str, Dict[str, int]]   = defaultdict(lambda: {"total": 0, "pass": 0})

    for tx in transactions:
        verified = tx["final_result"] == "IDENTITY_VERIFIED"
        path: List[tuple] = []

        path.append(("REQUEST_IN", "DOC_VERIFY"))
        node_stats["REQUEST_IN"]["total"] += 1
        if verified:
            node_stats["REQUEST_IN"]["pass"] += 1

        if tx["doc_result"] != "IDENTITY_DOCUMENT_VALIDATED":
            path.append(("DOC_VERIFY", "IDENTITY_NOT_VERIFIED"))
            node_stats["DOC_VERIFY"]["total"] += 1
        else:
            path.append(("DOC_VERIFY", "FACE_SCAN"))
            node_stats["DOC_VERIFY"]["total"] += 1
            if verified:
                node_stats["DOC_VERIFY"]["pass"] += 1

            path.append(("FACE_SCAN", "GSA_CHECK"))
            node_stats["FACE_SCAN"]["total"] += 1
            if verified:
                node_stats["FACE_SCAN"]["pass"] += 1

            gsa_stop = (tx["cmra_flag"] or tx["pbsa_flag"] or tx["pobox_flag"] or
                        tx["comm_error"] or
                        (tx["fault_code"] == "KOEC0039" and tx.get("fault_sub_code") == "X"))
            if gsa_stop:
                path.append(("GSA_CHECK", "IDENTITY_NOT_VERIFIED"))
            else:
                path.append(("GSA_CHECK", "PDMA_CHECK"))
                node_stats["GSA_CHECK"]["total"] += 1
                if verified:
                    node_stats["GSA_CHECK"]["pass"] += 1

                if tx["pdma_result"] is not None:
                    if tx["pdma_result"] != "ADDRESS_CIP_COMPLIANT":
                        path.append(("PDMA_CHECK", "IDENTITY_NOT_VERIFIED"))
                    else:
                        path.append(("PDMA_CHECK", "RISK_EVAL"))
                        node_stats["PDMA_CHECK"]["total"] += 1
                        if verified:
                            node_stats["PDMA_CHECK"]["pass"] += 1

                        if tx["risk_result"] is not None:
                            node_stats["RISK_EVAL"]["total"] += 1
                            if verified:
                                node_stats["RISK_EVAL"]["pass"] += 1
                            path.append(("RISK_EVAL",
                                         "IDENTITY_VERIFIED" if verified else "IDENTITY_NOT_VERIFIED"))

        for src, tgt in path:
            link_counts[(src, tgt)]["total"] += 1
            if verified:
                link_counts[(src, tgt)]["pass"] += 1
            else:
                link_counts[(src, tgt)]["fail"] += 1

    nodes = [
        {
            "id":        i,
            "name":      n,
            "pass_rate": round(
                node_stats[n]["pass"] / max(node_stats[n]["total"], 1) * 100, 1
            ) if n in node_stats else 0,
            "total": node_stats[n]["total"],
        }
        for i, n in enumerate(NODES)
    ]

    links = [
        {
            "source":    NODE_INDEX[src],
            "target":    NODE_INDEX[tgt],
            "value":     stats["total"],
            "pass":      stats["pass"],
            "fail":      stats["fail"],
            "pass_rate": round(stats["pass"] / max(stats["total"], 1) * 100, 1),
        }
        for (src, tgt), stats in link_counts.items()
        if src in NODE_INDEX and tgt in NODE_INDEX and stats["total"] > 0
    ]

    return {"nodes": nodes, "links": links}
