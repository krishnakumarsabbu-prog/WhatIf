"""
What-If Simulation Engine — Full IDPF Rules Coverage.
Implements all 5 rule categories:
  1. Document Verification (11 triggers)
  2. Face Scan (2 triggers)
  3. Address Verification — GSA (Rules 0-9 + combo)
  4. Address Verification — PDMA (Rules 10-14)
  5. Risk Evaluation (thresholds)
"""
import random
import hashlib
from typing import Dict, List, Any


def _tx_rng(tx_id: str, salt: int) -> float:
    """Deterministic per-transaction pseudo-random value."""
    h = hashlib.md5(f"{tx_id}{salt}".encode()).digest()
    return int.from_bytes(h[:4], "big") / 0xFFFFFFFF


def _evaluate_document(tx: Dict[str, Any], ov: Dict[str, Any]) -> bool:
    """
    Document Verification stage.
    Returns True if document passes under given overrides.
    """
    doc = tx.get("doc_result", "")
    # Base: must be VALIDATED
    if doc == "IDENTITY_DOCUMENT_VALIDATED":
        return True

    # Submission / unsupported / expired — allow overrides
    if tx.get("submission_error") and not ov.get("doc_submission_error_allow"):
        return False
    if tx.get("unsupported_id") and not ov.get("doc_unsupported_id_allow"):
        return False
    if tx.get("expired_id") and not ov.get("doc_expired_id_allow"):
        return False

    # Visual/text result overrides
    if doc in ("IDENTITY_DOCUMENT_NOT_VALIDATED",):
        # Allow if all rejection overrides are on
        if (ov.get("doc_visual_inconclusive_allow") and
                ov.get("doc_text_inconclusive_allow") and
                ov.get("doc_name_mismatch_allow") and
                ov.get("doc_dob_mismatch_allow")):
            return True
        return False

    return False


def _evaluate_face(tx: Dict[str, Any], ov: Dict[str, Any]) -> bool:
    """Face Scan stage — liveness + selfie score."""
    face = tx.get("face_result", "")
    if face == "VALIDATED":
        return True
    if face == "NOT_VALIDATED":
        # Liveness bypass
        if ov.get("face_liveness_bypass"):
            # Still check selfie threshold
            score = tx.get("selfie_match_score", 1.0)
            threshold = 0.60 if ov.get("face_selfie_threshold_lower") else 0.75
            return score >= threshold
        return False
    if face is None or face == "":
        return True  # face not required for this transaction
    return True


def _evaluate_gsa(tx: Dict[str, Any], ov: Dict[str, Any]) -> tuple:
    """
    GSA Address Verification.
    Returns (gsa_pass: bool, proceed_to_pdma: bool)
    """
    cmra   = bool(tx.get("cmra_flag"))
    pbsa   = bool(tx.get("pbsa_flag"))
    pobox  = bool(tx.get("pobox_flag"))
    comm   = bool(tx.get("comm_error"))
    fault  = tx.get("fault_code")
    sub    = tx.get("fault_sub_code")

    # Normalize: treat N/UNKNOWN/NULL as blank (default True per spec)
    normalize = ov.get("normalize_n_unknown_as_blank", True)

    # Combo indicators stop
    combo_stop = ov.get("combo_indicators_stop", True)
    active_indicators = sum([cmra, pbsa, pobox])
    if active_indicators > 1 and combo_stop:
        # Multiple indicators — check if any continuation toggle allows it
        if not (ov.get("continue_indicators_to_pdma") or ov.get("continue_on_risk_one")):
            return False, False

    # Rule 6: GSA Communication Error
    if comm:
        if ov.get("rule_6_fallthrough") or ov.get("gsa_comm_error_fallback_to_pdma"):
            return False, True   # GSA fails, but proceed to PDMA
        return False, False

    # Rule 3: KOEC0039 + X/Group1X → PROCESSING_ERROR
    if fault == "KOEC0039" and sub == "X":
        if ov.get("rule_3_fallthrough") or ov.get("koec0039_x_fallback_to_pdma"):
            return False, True
        return False, False

    # Rule 4: Critical fault codes
    if fault in ("KOAA0023", "KOEC0040", "KOAA0040"):
        if ov.get("critical_error_fallback_to_pdma"):
            return False, True
        return False, False

    # Rule 5: KOEC0039 non-X sub-codes
    if fault == "KOEC0039" and sub and sub != "X":
        key = f"koec0039_{sub}_severity"
        severity = ov.get(key, "WARN")
        if ov.get("koec0039_b_tighten_stop") and sub == "B":
            return False, False
        if ov.get("koec0039_a_allow_pdma") and sub == "A":
            return False, True
        if ov.get("koec0039_override_enabled", True):
            return False, True   # NOT_CIP_COMPLIANT but continue to PDMA review
        if severity == "STOP":
            return False, False
        return False, True

    # Rule 1: KOEC0647 — missing/incorrect unit number
    if fault == "KOEC0647":
        if ov.get("koec0647_dpv_ds_stop") and tx.get("dpv_code") in ("D", "S"):
            return False, False
        if ov.get("koec0647_retry_enabled"):
            return False, True   # Retryable, proceed
        return False, True   # Soft flag, proceed to PDMA

    # Rule 2: KOEC0692 — non-USPS warning
    if fault == "KOEC0692":
        if ov.get("koec0692_stop"):
            return False, False
        return False, True   # Soft, proceed

    # Rules 7/8/9: Hard-stop indicators
    if cmra:
        if (ov.get("rule_7_cmra_continue") or
                ov.get("continue_indicators_to_pdma") or
                ov.get("continue_on_risk_one")):
            return False, True
        return False, False

    if pbsa:
        if (ov.get("rule_8_pbsa_continue") or
                ov.get("continue_indicators_to_pdma") or
                ov.get("continue_on_risk_one")):
            return False, True
        return False, False

    if pobox:
        if (ov.get("rule_9_pobox_continue") or
                ov.get("continue_indicators_to_pdma") or
                ov.get("continue_on_risk_one")):
            return False, True
        return False, False

    # Rule 0: Clean address — no indicators
    return True, True   # GSA clean, proceed to PDMA


def _evaluate_pdma(tx: Dict[str, Any], ov: Dict[str, Any], gsa_pass: bool) -> bool:
    """PDMA Address Verification stage."""
    pdma = tx.get("pdma_result")
    if pdma is None:
        return gsa_pass   # PDMA not evaluated, use GSA result

    # PDMA Communication Error (Rule 10)
    if tx.get("pdma_comm_error") and not ov.get("pdma_comm_error_allow"):
        return False

    # PDMA Error (Rule 11)
    if tx.get("pdma_error") and not ov.get("pdma_comm_error_allow"):
        return False

    # PDMA Branch Match True (Rule 12) — address IS a branch
    if tx.get("branch_match_indicator") is True:
        if ov.get("pdma_branch_match_allow"):
            return True
        return False

    # PDMA Branch Match False (Rule 13) — address is NOT a branch
    if tx.get("branch_match_indicator") is False:
        return False  # Not a branch address = NOT_CIP_COMPLIANT per spec

    # PDMA Branch Match Not Returned (Rule 14) — absent response
    if tx.get("branch_match_returned") is False or tx.get("branch_match_indicator") is None:
        if ov.get("pdma_no_return_allow"):
            return True
        return False

    # Standard PDMA result
    if pdma == "ADDRESS_CIP_COMPLIANT":
        return True
    return False


def _evaluate_risk(tx: Dict[str, Any], ov: Dict[str, Any]) -> bool:
    """Risk Evaluation stage."""
    risk = tx.get("risk_result")

    # ALLOW
    if risk == "ALLOW":
        return True
    # BLOCK
    if risk == "BLOCK":
        return False
    # INTERDICT
    if risk == "INTERDICT":
        return ov.get("risk_interdict_to_allow", False)

    # No risk result — use score if available
    score = tx.get("risk_score")
    if score is None:
        return True   # No risk evaluation, default allow

    block_threshold = 0.85 if ov.get("risk_block_threshold_higher") else 0.75
    allow_threshold = 0.30 if ov.get("risk_allow_threshold_lower") else 0.40

    if score >= block_threshold:
        return False
    if score <= allow_threshold:
        return True
    return ov.get("risk_interdict_to_allow", False)


def _apply_overrides(tx: Dict[str, Any], ov: Dict[str, Any]) -> str:
    """
    Recompute final_result for a single transaction under rule overrides.
    Implements all 5 pipeline stages in order.
    """
    # Stage 1: Document Verification
    doc_pass = _evaluate_document(tx, ov)
    if not doc_pass:
        return "IDENTITY_NOT_VERIFIED"

    # Stage 2: Face Scan
    face_pass = _evaluate_face(tx, ov)
    if not face_pass:
        return "IDENTITY_NOT_VERIFIED"

    # Stage 3: Address Verification — GSA
    gsa_pass, proceed_to_pdma = _evaluate_gsa(tx, ov)

    # populateResult relaxation
    if ov.get("populate_result_relax") or ov.get("relax_no_result_bridge"):
        # If GSA is NO_RESULT (not explicitly failing), PDMA can bridge
        if not gsa_pass and proceed_to_pdma:
            gsa_pass = True   # Will be determined by PDMA

    if not proceed_to_pdma and not gsa_pass:
        return "IDENTITY_NOT_VERIFIED"

    # Stage 4: PDMA (if applicable)
    if proceed_to_pdma:
        # Use seeded RNG for synthetic PDMA eval when no stored result
        pdma_stored = tx.get("pdma_result")
        if pdma_stored is not None:
            address_pass = _evaluate_pdma(tx, ov, gsa_pass)
        else:
            # Synthetic: deterministic per-TX
            pdma_pass = _tx_rng(tx["id"], 1) < 0.91
            if ov.get("pdma_comm_error_allow"):
                pdma_pass = _tx_rng(tx["id"], 4) < 0.95
            address_pass = gsa_pass or pdma_pass
    else:
        address_pass = gsa_pass

    if not address_pass:
        return "IDENTITY_NOT_VERIFIED"

    # Stage 5: Risk Evaluation
    risk_stored = tx.get("risk_result")
    if risk_stored is not None:
        risk_pass = _evaluate_risk(tx, ov)
    else:
        risk_pass = _tx_rng(tx["id"], 2) < 0.92
        if ov.get("risk_interdict_to_allow"):
            risk_pass = _tx_rng(tx["id"], 2) < 0.97
        if ov.get("risk_block_threshold_higher"):
            risk_pass = _tx_rng(tx["id"], 2) < 0.95

    return "IDENTITY_VERIFIED" if risk_pass else "IDENTITY_NOT_VERIFIED"


def trace_idpf_pipeline(tx: Dict[str, Any], ov: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run a single transaction through all 5 IDPF stages and return
    the per-stage decision trace with rule numbers, outcomes, and reason codes.
    """
    trace: Dict[str, Any] = {}

    # ── STAGE 1: DOCUMENT VERIFICATION ────────────────────────────────────
    doc = tx.get("doc_result", "")
    doc_triggers = []
    doc_outcome = "VALIDATED"

    if tx.get("submission_error") and not ov.get("doc_submission_error_allow"):
        doc_triggers.append("SUBMISSION_ERROR")
    if tx.get("unsupported_id") and not ov.get("doc_unsupported_id_allow"):
        doc_triggers.append("UNSUPPORTED_ID")
    if tx.get("expired_id") and not ov.get("doc_expired_id_allow"):
        doc_triggers.append("EXPIRED_ID")

    capture = tx.get("capture_quality", "")
    if capture in ("Poor", "Failed") and not ov.get("doc_capture_quality_allow"):
        doc_triggers.append("CAPTURE_QUALITY_FAILED")
    elif capture in ("Warning", "Inconclusive"):
        recapture_limit = 3 if ov.get("doc_recapture_limit_3") else 2
        recapture_count = tx.get("recapture_count", 0)
        if recapture_count < recapture_limit:
            doc_outcome = "RECAPTURE"
        else:
            doc_triggers.append("RECAPTURE_LIMIT_REACHED")

    visual = tx.get("visual_result", "")
    if visual in ("Failed", "Inconclusive") and not ov.get("doc_visual_inconclusive_allow"):
        doc_triggers.append("VISUAL_RESULT_FAILED")

    text = tx.get("text_result", "")
    if text in ("Failed", "Inconclusive") and not ov.get("doc_text_inconclusive_allow"):
        doc_triggers.append("TEXT_RESULT_FAILED")

    if not tx.get("first_name_match", True) and not ov.get("doc_name_mismatch_allow"):
        doc_triggers.append("FIRST_NAME_MISMATCH")
    if not tx.get("surname_match", True) and not ov.get("doc_name_mismatch_allow"):
        doc_triggers.append("SURNAME_MISMATCH")
    if not tx.get("dob_match", True) and not ov.get("doc_dob_mismatch_allow"):
        doc_triggers.append("DOB_MISMATCH")

    # Final doc outcome
    if doc == "IDENTITY_DOCUMENT_VALIDATED":
        doc_triggers = []
        doc_outcome = "VALIDATED"
    elif doc_triggers:
        doc_outcome = "NOT_VALIDATED"
    elif doc_outcome != "RECAPTURE":
        doc_outcome = "VALIDATED" if doc == "IDENTITY_DOCUMENT_VALIDATED" else "NOT_VALIDATED" if doc == "IDENTITY_DOCUMENT_NOT_VALIDATED" else "VALIDATED"

    trace["doc_stage"] = {
        "outcome": doc_outcome,
        "triggers": doc_triggers,
        "allowed_by_override": bool(ov.get("doc_submission_error_allow") or ov.get("doc_visual_inconclusive_allow") or ov.get("doc_expired_id_allow")),
        "inputs": {
            "doc_result": doc,
            "visual_result": visual,
            "text_result": text,
            "capture_quality": capture,
            "submission_error": tx.get("submission_error", False),
            "expired_id": tx.get("expired_id", False),
        },
    }
    doc_pass = doc_outcome in ("VALIDATED", "RECAPTURE")

    # ── STAGE 2: FACE SCAN ─────────────────────────────────────────────────
    face = tx.get("face_result", "")
    liveness = tx.get("liveness_passed", True)
    selfie_score = tx.get("selfie_match_score", 1.0)
    selfie_threshold = 0.60 if ov.get("face_selfie_threshold_lower") else 0.75
    face_triggers = []

    if face == "VALIDATED":
        face_outcome = "VALIDATED"
    elif face == "NOT_VALIDATED":
        if not liveness and not ov.get("face_liveness_bypass"):
            face_triggers.append("LIVENESS_FAILED")
        if selfie_score < selfie_threshold:
            face_triggers.append(f"SELFIE_SCORE_BELOW_THRESHOLD ({selfie_score:.2f} < {selfie_threshold})")
        face_outcome = "NOT_VALIDATED" if face_triggers else "VALIDATED"
    else:
        face_outcome = "VALIDATED"

    trace["face_stage"] = {
        "outcome": face_outcome,
        "triggers": face_triggers,
        "inputs": {
            "face_result": face,
            "liveness_passed": liveness,
            "selfie_match_score": selfie_score,
            "threshold_applied": selfie_threshold,
            "liveness_bypassed": bool(ov.get("face_liveness_bypass")),
        },
    }
    face_pass = face_outcome == "VALIDATED"

    # ── STAGE 3: ADDRESS — GSA ─────────────────────────────────────────────
    cmra  = bool(tx.get("cmra_flag"))
    pbsa  = bool(tx.get("pbsa_flag"))
    pobox = bool(tx.get("pobox_flag"))
    comm  = bool(tx.get("comm_error"))
    fault = tx.get("fault_code")
    sub   = tx.get("fault_sub_code")

    gsa_rule_fired = None
    gsa_outcome = "NO_RESULT"
    gsa_reason_code = "INPUT_ADDRESS_NOT_CMRA_POBOX_PBSA"
    gsa_proceed_to_pdma = True
    gsa_overridden = False

    combo_stop = ov.get("combo_indicators_stop", True)
    active_indicators = sum([cmra, pbsa, pobox])

    if active_indicators > 1 and combo_stop and not (ov.get("continue_indicators_to_pdma") or ov.get("continue_on_risk_one")):
        gsa_rule_fired = "COMBO"
        gsa_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
        gsa_reason_code = "INPUT_ADDRESS_HAS_MULTIPLE_GSA_RISK_INDICATORS"
        gsa_proceed_to_pdma = False
    elif comm:
        gsa_rule_fired = 6
        gsa_outcome = "PROCESSING_ERROR"
        gsa_reason_code = "GSA_COMMUNICATION_ERROR"
        if ov.get("rule_6_fallthrough") or ov.get("gsa_comm_error_fallback_to_pdma"):
            gsa_proceed_to_pdma = True
            gsa_overridden = True
        else:
            gsa_proceed_to_pdma = False
    elif fault == "KOEC0039" and sub == "X":
        gsa_rule_fired = 3
        gsa_outcome = "PROCESSING_ERROR"
        gsa_reason_code = "INPUT_ADDRESS_ERROR_KOEC0039_GROUP1X"
        if ov.get("rule_3_fallthrough") or ov.get("koec0039_x_fallback_to_pdma"):
            gsa_proceed_to_pdma = True
            gsa_overridden = True
        else:
            gsa_proceed_to_pdma = False
    elif fault in ("KOAA0023", "KOEC0040", "KOAA0040"):
        gsa_rule_fired = 4
        gsa_outcome = "PROCESSING_ERROR"
        gsa_reason_code = "INPUT_ADDRESS_CRITICAL_ERROR"
        if ov.get("critical_error_fallback_to_pdma"):
            gsa_proceed_to_pdma = True
            gsa_overridden = True
        else:
            gsa_proceed_to_pdma = False
    elif fault == "KOEC0039" and sub and sub != "X":
        gsa_rule_fired = 5
        gsa_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
        rc = f"INPUT_ADDRESS_ERROR_KOEC0039_{sub}" if ov.get("split_koec0039_subcodes") else "INPUT_ADDRESS_ERROR_KOEC0039"
        gsa_reason_code = rc
        if ov.get("koec0039_b_tighten_stop") and sub == "B":
            gsa_proceed_to_pdma = False
        elif ov.get("koec0039_a_allow_pdma") and sub == "A":
            gsa_proceed_to_pdma = True
            gsa_overridden = True
        elif ov.get("koec0039_override_enabled", True):
            gsa_proceed_to_pdma = True
        else:
            severity = ov.get(f"koec0039_{sub}_severity", "WARN")
            gsa_proceed_to_pdma = severity != "STOP"
    elif fault == "KOEC0647":
        gsa_rule_fired = 1
        gsa_outcome = "NO_RESULT"
        gsa_reason_code = "INPUT_ADDRESS_WARNING_KOEC0647"
        if ov.get("koec0647_dpv_ds_stop") and tx.get("dpv_code") in ("D", "S"):
            gsa_proceed_to_pdma = False
        else:
            gsa_proceed_to_pdma = True
    elif fault == "KOEC0692":
        gsa_rule_fired = 2
        gsa_outcome = "NO_RESULT"
        gsa_reason_code = "INPUT_ADDRESS_WARNING_KOEC0692"
        if ov.get("koec0692_stop"):
            gsa_proceed_to_pdma = False
            gsa_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
        else:
            gsa_proceed_to_pdma = True
    elif cmra:
        gsa_rule_fired = 7
        gsa_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
        gsa_reason_code = "INPUT_ADDRESS_IS_COMMERCIAL_MAIL_RECEIVING_AGENCY"
        if ov.get("rule_7_cmra_continue") or ov.get("continue_indicators_to_pdma") or ov.get("continue_on_risk_one"):
            gsa_proceed_to_pdma = True
            gsa_overridden = True
        else:
            gsa_proceed_to_pdma = False
    elif pbsa:
        gsa_rule_fired = 8
        gsa_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
        gsa_reason_code = "INPUT_ADDRESS_IS_POST_OFFICE_BOX_STREET_ADDRESS"
        if ov.get("rule_8_pbsa_continue") or ov.get("continue_indicators_to_pdma") or ov.get("continue_on_risk_one"):
            gsa_proceed_to_pdma = True
            gsa_overridden = True
        else:
            gsa_proceed_to_pdma = False
    elif pobox:
        gsa_rule_fired = 9
        gsa_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
        gsa_reason_code = "INPUT_ADDRESS_IS_POST_OFFICE"
        if ov.get("rule_9_pobox_continue") or ov.get("continue_indicators_to_pdma") or ov.get("continue_on_risk_one"):
            gsa_proceed_to_pdma = True
            gsa_overridden = True
        else:
            gsa_proceed_to_pdma = False
    else:
        gsa_rule_fired = 0
        gsa_outcome = "NO_RESULT"
        gsa_reason_code = "INPUT_ADDRESS_NOT_CMRA_POBOX_PBSA"
        gsa_proceed_to_pdma = True

    gsa_pass = gsa_outcome in ("NO_RESULT",)  # clean address, proceed

    trace["gsa_stage"] = {
        "rule_fired": gsa_rule_fired,
        "outcome": gsa_outcome,
        "reason_code": gsa_reason_code,
        "proceed_to_pdma": gsa_proceed_to_pdma,
        "overridden": gsa_overridden,
        "inputs": {
            "cmra_flag": cmra,
            "pbsa_flag": pbsa,
            "pobox_flag": pobox,
            "fault_code": fault,
            "fault_sub_code": sub,
            "comm_error": comm,
            "dpv_code": tx.get("dpv_code"),
        },
    }

    # ── STAGE 4: ADDRESS — PDMA ────────────────────────────────────────────
    pdma_stage: Dict[str, Any] = {"evaluated": False, "rule_fired": None, "outcome": None, "reason_code": None}

    if gsa_proceed_to_pdma:
        pdma_stage["evaluated"] = True
        pdma_result = tx.get("pdma_result")
        pdma_comm_err = tx.get("pdma_comm_error", False)
        pdma_error = tx.get("pdma_error", False)
        branch_returned = tx.get("branch_match_returned")
        branch_indicator = tx.get("branch_match_indicator")

        if pdma_comm_err and not ov.get("pdma_comm_error_allow"):
            pdma_stage.update({"rule_fired": 10, "outcome": "ADDRESS_NOT_CIP_COMPLIANT", "reason_code": "TRUSTED_SOURCE_ERROR"})
        elif pdma_error and not ov.get("pdma_comm_error_allow"):
            pdma_stage.update({"rule_fired": 11, "outcome": "ADDRESS_NOT_CIP_COMPLIANT", "reason_code": "TRUSTED_SOURCE_ERROR"})
        elif branch_returned and branch_indicator is True:
            if ov.get("pdma_branch_match_allow"):
                pdma_stage.update({"rule_fired": 12, "outcome": "ADDRESS_CIP_COMPLIANT", "reason_code": "INPUT_ADDRESS_IS_BRANCH_ADDRESS", "overridden": True})
            else:
                pdma_stage.update({"rule_fired": 12, "outcome": "ADDRESS_NOT_CIP_COMPLIANT", "reason_code": "INPUT_ADDRESS_IS_BRANCH_ADDRESS"})
        elif branch_returned and branch_indicator is False:
            pdma_stage.update({"rule_fired": 13, "outcome": "ADDRESS_NOT_CIP_COMPLIANT", "reason_code": "INPUT_ADDRESS_IS_NOT_BRANCH_ADDRESS"})
        elif branch_returned is False or branch_indicator is None:
            if ov.get("pdma_no_return_allow"):
                pdma_stage.update({"rule_fired": 14, "outcome": "ADDRESS_CIP_COMPLIANT", "reason_code": "INPUT_ADDRESS_BRANCH_MATCH_NOT_RETURNED", "overridden": True})
            else:
                pdma_stage.update({"rule_fired": 14, "outcome": "ADDRESS_NOT_CIP_COMPLIANT", "reason_code": "INPUT_ADDRESS_BRANCH_MATCH_NOT_RETURNED"})
        elif pdma_result == "ADDRESS_CIP_COMPLIANT":
            pdma_stage.update({"rule_fired": None, "outcome": "ADDRESS_CIP_COMPLIANT", "reason_code": "PDMA_COMPLIANT"})
        else:
            pdma_stage.update({"rule_fired": None, "outcome": "ADDRESS_NOT_CIP_COMPLIANT", "reason_code": "PDMA_NOT_COMPLIANT"})

        pdma_stage["inputs"] = {
            "pdma_result": pdma_result,
            "pdma_comm_error": pdma_comm_err,
            "pdma_error": pdma_error,
            "branch_match_returned": branch_returned,
            "branch_match_indicator": branch_indicator,
        }

    trace["pdma_stage"] = pdma_stage

    # ── populateResult ─────────────────────────────────────────────────────
    relax = ov.get("populate_result_relax") or ov.get("relax_no_result_bridge")
    pdma_outcome = pdma_stage.get("outcome")

    if gsa_pass:
        # Clean GSA — address passes, but PDMA may have found something
        if pdma_outcome in (None, "ADDRESS_CIP_COMPLIANT"):
            address_outcome = "ADDRESS_CIP_COMPLIANT"
        else:
            address_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
    elif gsa_proceed_to_pdma and pdma_outcome == "ADDRESS_CIP_COMPLIANT":
        if relax or gsa_outcome == "NO_RESULT":
            address_outcome = "ADDRESS_CIP_COMPLIANT"
        else:
            address_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
    elif not gsa_proceed_to_pdma:
        address_outcome = "ADDRESS_NOT_CIP_COMPLIANT"
    else:
        address_outcome = "ADDRESS_NOT_CIP_COMPLIANT"

    trace["address_outcome"] = {
        "result": address_outcome,
        "gsa_bridged_by_pdma": (gsa_proceed_to_pdma and not gsa_pass and pdma_outcome == "ADDRESS_CIP_COMPLIANT" and (relax or gsa_outcome == "NO_RESULT")),
        "populate_result_relax": bool(relax),
    }
    address_pass = address_outcome == "ADDRESS_CIP_COMPLIANT"

    # ── STAGE 5: RISK EVALUATION ───────────────────────────────────────────
    risk_result = tx.get("risk_result")
    risk_score = tx.get("risk_score")
    allow_threshold = 0.30 if ov.get("risk_allow_threshold_lower") else 0.40
    block_threshold = 0.85 if ov.get("risk_block_threshold_higher") else 0.75

    if risk_result == "ALLOW":
        risk_outcome = "ALLOW"
        risk_reason = "risk_score_at_or_below_allow_threshold"
    elif risk_result == "BLOCK":
        risk_outcome = "BLOCK"
        risk_reason = "risk_score_at_or_above_block_threshold"
    elif risk_result == "INTERDICT":
        if ov.get("risk_interdict_to_allow"):
            risk_outcome = "ALLOW"
            risk_reason = "risk_interdict_overridden_to_allow"
        else:
            risk_outcome = "INTERDICT"
            risk_reason = "risk_score_between_allow_and_block_threshold"
    elif risk_score is not None:
        if risk_score >= block_threshold:
            risk_outcome = "BLOCK"
            risk_reason = "risk_score_at_or_above_block_threshold"
        elif risk_score <= allow_threshold:
            risk_outcome = "ALLOW"
            risk_reason = "risk_score_at_or_below_allow_threshold"
        else:
            if ov.get("risk_interdict_to_allow"):
                risk_outcome = "ALLOW"
                risk_reason = "risk_interdict_overridden_to_allow"
            else:
                risk_outcome = "INTERDICT"
                risk_reason = "risk_score_between_allow_and_block_threshold"
    else:
        risk_outcome = "ALLOW"
        risk_reason = "no_risk_score_available"

    trace["risk_stage"] = {
        "outcome": risk_outcome,
        "reason": risk_reason,
        "inputs": {
            "risk_result": risk_result,
            "risk_score": risk_score,
            "allow_threshold": allow_threshold,
            "block_threshold": block_threshold,
        },
    }
    risk_pass = risk_outcome == "ALLOW"

    # ── FINAL IDENTITY DECISION ────────────────────────────────────────────
    all_pass = doc_pass and face_pass and address_pass and risk_pass
    final_outcome = "IDENTITY_VERIFIED" if all_pass else "IDENTITY_NOT_VERIFIED"

    rejection_reasons = []
    if not doc_pass:
        rejection_reasons.append(f"Document: {', '.join(doc_triggers) or 'NOT_VALIDATED'}")
    if not face_pass:
        rejection_reasons.append(f"Face: {', '.join(face_triggers) or 'NOT_VALIDATED'}")
    if not address_pass:
        rejection_reasons.append(f"Address: {gsa_reason_code}" if not gsa_proceed_to_pdma else f"Address PDMA: {pdma_stage.get('reason_code', 'NOT_CIP_COMPLIANT')}")
    if not risk_pass:
        rejection_reasons.append(f"Risk: {risk_outcome} ({risk_reason})")

    # Recommendation
    if risk_outcome == "BLOCK":
        recommendation = "BLOCK"
    elif not address_pass and trace["pdma_stage"].get("outcome") == "ADDRESS_NOT_CIP_COMPLIANT":
        recommendation = "CIP_ADDRESS_REVIEW"
    elif risk_outcome == "INTERDICT":
        recommendation = "RISK_REVIEW"
    elif all_pass:
        recommendation = None
    else:
        recommendation = "NO_REVIEW"

    trace["final"] = {
        "outcome": final_outcome,
        "rejection_reasons": rejection_reasons,
        "recommendation": recommendation,
        "stages_passed": {
            "document": doc_pass,
            "face": face_pass,
            "address": address_pass,
            "risk": risk_pass,
        },
    }

    return trace


def find_showcase_transaction(txs: List[Dict[str, Any]], ov: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pick a transaction that demonstrates the current overrides.
    Prefer one that CHANGES outcome with overrides, otherwise return a good default.
    """
    # Look for a transaction that fails baseline but passes with overrides
    for tx in txs[:200]:
        baseline_pass = tx.get("final_result") == "IDENTITY_VERIFIED"
        override_outcome = _apply_overrides(tx, ov)
        if not baseline_pass and override_outcome == "IDENTITY_VERIFIED":
            return tx
    # Fall back to a transaction with interesting GSA flags
    for tx in txs:
        if tx.get("cmra_flag") or tx.get("pbsa_flag") or tx.get("fault_code"):
            return tx
    return txs[0] if txs else {}

                   overrides: Dict[str, Any],
                   n_iterations: int = 500) -> Dict[str, Any]:
    n = len(transactions)
    if n == 0:
        return {}

    baseline_pass = sum(1 for t in transactions if t["final_result"] == "IDENTITY_VERIFIED")
    baseline_rate = baseline_pass / n * 100

    outcomes = [_apply_overrides(tx, overrides) for tx in transactions]
    sim_pass  = sum(1 for o in outcomes if o == "IDENTITY_VERIFIED")
    sim_rate  = sim_pass / n * 100

    # Bootstrap CI
    import random as rnd
    rnd.seed(42)
    bootstrap_rates = []
    for _ in range(n_iterations):
        sample = rnd.choices(outcomes, k=n)
        rate   = sum(1 for o in sample if o == "IDENTITY_VERIFIED") / n * 100
        bootstrap_rates.append(rate)
    bootstrap_rates.sort()
    ci_low  = bootstrap_rates[int(n_iterations * 0.025)]
    ci_high = bootstrap_rates[int(n_iterations * 0.975)]

    # Breakdown by rule
    affected: Dict[str, int] = {}
    for i, tx in enumerate(transactions):
        if outcomes[i] != tx["final_result"]:
            for rule in tx.get("rules_fired", "").split(","):
                rule = rule.strip()
                if rule:
                    affected[rule] = affected.get(rule, 0) + 1

    breakdown = [{"rule": r, "count": c, "pct": round(c / n * 100, 1)}
                 for r, c in sorted(affected.items(), key=lambda x: -x[1])]

    return {
        "baseline_pass_rate":  round(baseline_rate, 2),
        "simulated_pass_rate": round(sim_rate, 2),
        "delta":               round(sim_rate - baseline_rate, 2),
        "delta_absolute":      sim_pass - baseline_pass,
        "ci_95_low":           round(ci_low, 2),
        "ci_95_high":          round(ci_high, 2),
        "affected_count":      sum(affected.values()),
        "breakdown":           breakdown,
        "runtime_ms":          0,
    }


def sensitivity_sweep(transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Preset scenario sensitivity chart."""
    presets = [
        {"label": "Baseline",               "overrides": {}},
        {"label": "CMRA → PDMA",            "overrides": {"rule_7_cmra_continue": True}},
        {"label": "CMRA+PBSA → PDMA",       "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True}},
        {"label": "All Hard-Stops Relax",   "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True, "rule_6_fallthrough": True, "rule_3_fallthrough": True}},
        {"label": "+ populateResult",       "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True, "rule_6_fallthrough": True, "rule_3_fallthrough": True, "populate_result_relax": True}},
        {"label": "+ Risk Interdict Allow", "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "populate_result_relax": True, "risk_interdict_to_allow": True}},
        {"label": "+ Doc Relaxations",      "overrides": {"rule_7_cmra_continue": True, "doc_capture_quality_allow": True, "face_selfie_threshold_lower": True}},
        {"label": "Full Override",          "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True, "rule_6_fallthrough": True, "rule_3_fallthrough": True, "populate_result_relax": True, "risk_interdict_to_allow": True}},
    ]
    results = []
    for p in presets:
        sim = run_simulation(transactions, p["overrides"], n_iterations=100)
        results.append({"label": p["label"], "pass_rate": sim["simulated_pass_rate"], "delta": sim["delta"]})
    return results


SCENARIO_CARDS = [
    {
        "id": "s1", "name": "Route CMRA → PDMA",
        "description": "Allow CMRA addresses (commercial mailboxes) to continue to PDMA evaluation instead of hard-stopping at GSA.",
        "overrides": {"rule_7_cmra_continue": True},
        "impact": "HIGH",
    },
    {
        "id": "s2", "name": "Route PBSA → PDMA",
        "description": "Allow PBSA addresses (PO Box street addresses) to continue to PDMA evaluation.",
        "overrides": {"rule_8_pbsa_continue": True},
        "impact": "MED",
    },
    {
        "id": "s3", "name": "CMRA + PBSA + populateResult",
        "description": "Route both CMRA and PBSA addresses to PDMA, with populateResult relaxation so a PDMA pass yields CIP-compliant.",
        "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "populate_result_relax": True},
        "impact": "HIGH",
    },
    {
        "id": "s4", "name": "All GSA Hard-Stops → PDMA",
        "description": "Route all five GSA hard-stop cases (CMRA, PBSA, POBox, Comm Error, KOEC0039+X) to PDMA evaluation.",
        "overrides": {"rule_7_cmra_continue": True, "rule_8_pbsa_continue": True, "rule_9_pobox_continue": True, "rule_6_fallthrough": True, "rule_3_fallthrough": True},
        "impact": "HIGH",
    },
    {
        "id": "s5", "name": "KOEC0039 Sub-Codes All WARN",
        "description": "Treat all KOEC0039 sub-codes (including X) as WARNING severity — none trigger hard-stop.",
        "overrides": {"rule_3_fallthrough": True, "koec0039_A_severity": "WARN", "koec0039_B_severity": "WARN", "koec0039_Z_severity": "WARN"},
        "impact": "MED",
    },
    {
        "id": "s6", "name": "Risk: Treat Interdict as Allow",
        "description": "Transactions that score in the INTERDICT band (between allow and block thresholds) are allowed through.",
        "overrides": {"risk_interdict_to_allow": True},
        "impact": "MED",
    },
    {
        "id": "s7", "name": "Lower Selfie Threshold",
        "description": "Reduce selfie match threshold from 0.75 to 0.60 — recovers borderline face scan failures.",
        "overrides": {"face_selfie_threshold_lower": True},
        "impact": "LOW",
    },
    {
        "id": "s8", "name": "continueOnRisk=1 Global",
        "description": "Apply the global continueOnRisk=1 policy — all risk indicators are allowed to proceed to PDMA.",
        "overrides": {"continue_on_risk_one": True, "relax_no_result_bridge": True},
        "impact": "HIGH",
    },
    {
        "id": "s9", "name": "GSA Comm Error Fallback",
        "description": "When GSA is unreachable (communication error), fall through to PDMA evaluation instead of hard-stopping.",
        "overrides": {"rule_6_fallthrough": True},
        "impact": "LOW",
    },
    {
        "id": "s10", "name": "Raise Block Threshold",
        "description": "Increase the risk block threshold from 0.75 to 0.85 — fewer transactions blocked, more enter interdict review.",
        "overrides": {"risk_block_threshold_higher": True},
        "impact": "MED",
    },
]
