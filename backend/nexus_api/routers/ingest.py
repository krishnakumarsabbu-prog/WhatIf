"""Ingest router — accepts IDPF request/response JSON pairs."""
import uuid
import datetime
from fastapi import APIRouter, HTTPException
from typing import List

from ..database import query, execute
from ..engines.shap_engine import explain_transaction
from ..models.domain import IngestRequest

router = APIRouter()


def _parse_transaction(req: dict, resp: dict) -> dict:
    """Extract normalized features from raw IDPF request/response."""
    tx_id      = resp.get("transactionId") or req.get("transactionId") or str(uuid.uuid4())[:8]
    final      = resp.get("result", "IDENTITY_NOT_VERIFIED")
    doc_result = "IDENTITY_DOCUMENT_VALIDATED"
    face_result = "VALIDATED"

    # Extract from resultSummary
    rules_fired = []
    for s in resp.get("resultSummary", []):
        activity = s.get("activity", "")
        result   = s.get("result", "")
        if "DOC" in activity.upper() and result == "FAIL":
            doc_result = "IDENTITY_DOCUMENT_NOT_VALIDATED"
        if "FACE" in activity.upper() and result == "FAIL":
            face_result = "NOT_VALIDATED"

    # Extract GSA features from reasons
    cmra_flag  = False
    pbsa_flag  = False
    pobox_flag = False
    comm_error = False
    fault_code = None

    for r in resp.get("resultReasons", []):
        rc = r.get("reasonCode", "")
        if "CMRA" in rc:
            cmra_flag = True
            rules_fired.append("Rule 7")
        if "PBSA" in rc:
            pbsa_flag = True
            rules_fired.append("Rule 8")
        if "POBOX" in rc or "PO_BOX" in rc:
            pobox_flag = True
            rules_fired.append("Rule 9")
        if "KOEC0039" in rc:
            fault_code = "KOEC0039"
            rules_fired.append("Rule 3" if "X" in rc else "Rule 5")
        if "COMM_ERROR" in rc or "PROCESSING_ERROR" in rc:
            comm_error = True
            rules_fired.append("Rule 6")

    if not rules_fired:
        rules_fired = ["Rule 0"]

    gsa_result  = "ADDRESS_NOT_CIP_COMPLIANT" if (cmra_flag or pbsa_flag or pobox_flag or comm_error) else "ADDRESS_CIP_COMPLIANT"
    pdma_result = None
    risk_result = None

    return {
        "id":          f"ING-{tx_id[:8]}",
        "event_date":  datetime.date.today().isoformat(),
        "doc_result":  doc_result,
        "face_result": face_result,
        "cmra_flag":   int(cmra_flag),
        "pbsa_flag":   int(pbsa_flag),
        "pobox_flag":  int(pobox_flag),
        "comm_error":  int(comm_error),
        "fault_code":  fault_code,
        "fault_sub_code": None,
        "gsa_result":  gsa_result,
        "pdma_result": pdma_result,
        "risk_result": risk_result,
        "final_result": final,
        "rules_fired": ",".join(rules_fired),
    }


@router.post("/transaction")
def ingest_transaction(request: IngestRequest):
    tx = _parse_transaction(request.request, request.response)

    # Store in DB
    execute(
        """INSERT OR REPLACE INTO transactions
           (id, event_date, doc_result, face_result, cmra_flag, pbsa_flag, pobox_flag,
            comm_error, fault_code, fault_sub_code, gsa_result, pdma_result,
            risk_result, final_result, rules_fired)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (tx["id"], tx["event_date"], tx["doc_result"], tx["face_result"],
         tx["cmra_flag"], tx["pbsa_flag"], tx["pobox_flag"], tx["comm_error"],
         tx["fault_code"], tx["fault_sub_code"], tx["gsa_result"], tx["pdma_result"],
         tx["risk_result"], tx["final_result"], tx["rules_fired"])
    )

    all_txs = query("SELECT * FROM transactions")
    shap    = explain_transaction(tx, all_txs)

    return {"transaction_id": tx["id"], "parsed_features": tx,
            "rule_trace": tx["rules_fired"].split(","), "shap": shap}


@router.post("/bulk")
def ingest_bulk(requests: List[IngestRequest]):
    results = []
    for req in requests:
        try:
            result = ingest_transaction(req)
            results.append({"status": "ok", "id": result["transaction_id"]})
        except Exception as e:
            results.append({"status": "error", "error": str(e)})
    ok  = sum(1 for r in results if r["status"] == "ok")
    err = len(results) - ok
    return {"ingested": ok, "errors": err, "results": results}


@router.get("/analyze-json")
def analyze_transaction_json(tx_id: str):
    """Analyze a stored transaction by ID."""
    tx_list = query("SELECT * FROM transactions WHERE id = ?", (tx_id,))
    if not tx_list:
        raise HTTPException(404, f"Transaction {tx_id} not found")
    all_txs = query("SELECT * FROM transactions")
    tx = tx_list[0]
    shap = explain_transaction(tx, all_txs)
    return {"transaction": tx, "shap": shap, "rule_trace": tx["rules_fired"].split(",")}
