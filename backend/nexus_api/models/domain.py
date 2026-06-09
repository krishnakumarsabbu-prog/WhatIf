"""Pydantic domain models for request/response validation."""
from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class RuleOverrides(BaseModel):
    # ── DOCUMENT VERIFICATION ────────────────────────────────────────────────
    doc_submission_error_allow:    bool = False   # Allow past submission errors
    doc_unsupported_id_allow:      bool = False   # Allow unsupported ID types
    doc_expired_id_allow:          bool = False   # Allow expired IDs
    doc_visual_inconclusive_allow: bool = False   # Allow Failed/Inconclusive visual result
    doc_text_inconclusive_allow:   bool = False   # Allow Failed/Inconclusive text result
    doc_name_mismatch_allow:       bool = False   # Allow first name / surname mismatches
    doc_dob_mismatch_allow:        bool = False   # Allow date of birth mismatch
    doc_capture_quality_allow:     bool = False   # Allow Poor/Failed capture quality
    doc_recapture_limit_3:         bool = False   # Set recapture limit to 3 (default: 2)

    # ── FACE SCAN ────────────────────────────────────────────────────────────
    face_liveness_bypass:          bool = False   # Skip liveness check requirement
    face_selfie_threshold_lower:   bool = False   # Lower selfie match threshold 0.75→0.60

    # ── ADDRESS VERIFICATION — GSA HARD-STOP OVERRIDES ──────────────────────
    rule_7_cmra_continue:          bool = False   # CMRA=Y → continue to PDMA (not hard-stop)
    rule_8_pbsa_continue:          bool = False   # PBSA=Y → continue to PDMA
    rule_9_pobox_continue:         bool = False   # POBox=P → continue to PDMA
    rule_6_fallthrough:            bool = False   # GSA Comm Error → fallthrough to PDMA
    rule_3_fallthrough:            bool = False   # KOEC0039+X → fallthrough to PDMA

    # ── ADDRESS VERIFICATION — GSA FAULT CODE TOGGLES ───────────────────────
    koec0647_retry_enabled:        bool = False   # Mark KOEC0647 (missing #) as retryable
    koec0647_dpv_ds_stop:          bool = False   # Stop if DPV code D/S with KOEC0647
    koec0692_stop:                 bool = False   # Tighten KOEC0692 warning to hard-stop
    koec0039_a_allow_pdma:         bool = False   # KOEC0039 sub-code A → soften to PDMA
    koec0039_b_tighten_stop:       bool = False   # KOEC0039 sub-code B → hard-stop
    split_koec0039_subcodes:       bool = False   # Append return code to reason code
    critical_error_fallback_to_pdma: bool = False  # KOAA0023/KOEC0040 → fallback to PDMA
    combo_indicators_stop:         bool = True    # Multiple GSA indicators → hard-stop
    continue_on_risk_one:          bool = False   # Global continueOnRisk=1 behavior
    continue_indicators_to_pdma:   bool = False   # Any risk indicator → continue to PDMA
    normalize_n_unknown_as_blank:  bool = True    # Treat N/UNKNOWN/NULL as blank

    # ── ADDRESS VERIFICATION — KOEC0039 SUB-CODE SEVERITIES ─────────────────
    koec0039_A_severity:           str  = 'WARN'
    koec0039_B_severity:           str  = 'STOP'
    koec0039_H_severity:           str  = 'WARN'
    koec0039_M_severity:           str  = 'WARN'
    koec0039_S_severity:           str  = 'WARN'
    koec0039_Z_severity:           str  = 'STOP'

    # ── ADDRESS VERIFICATION — PDMA OVERRIDES ────────────────────────────────
    pdma_comm_error_allow:         bool = False   # Allow PDMA comm errors (not hard-fail)
    pdma_branch_match_allow:       bool = False   # Allow branch-address matches to pass
    pdma_no_return_allow:          bool = False   # Allow missing branch-match response

    # ── ADDRESS VERIFICATION — POPULATE RESULT ───────────────────────────────
    populate_result_relax:         bool = False   # NO_RESULT+PDMA compliant = COMPLIANT
    relax_no_result_bridge:        bool = False   # GSA NO_RESULT bridged by PDMA pass
    koec0039_override_enabled:     bool = True    # Force NOT_CIP_COMPLIANT for KOEC0039
    entity_action_change_enabled:  bool = True    # Apply entity-specific rec rules

    # ── RISK EVALUATION ──────────────────────────────────────────────────────
    risk_allow_threshold_lower:    bool = False   # Lower allow threshold 0.40→0.30
    risk_block_threshold_higher:   bool = False   # Raise block threshold 0.75→0.85
    risk_interdict_to_allow:       bool = False   # Treat INTERDICT outcomes as ALLOW


class SimulationRequest(BaseModel):
    rule_overrides: RuleOverrides = RuleOverrides()
    n_iterations:   int = 500


class SaveScenarioRequest(BaseModel):
    name:           str
    rule_overrides: RuleOverrides
    result:         Dict[str, Any]


class EvidenceMap(BaseModel):
    DOC_VERIFY:        Optional[str] = None
    FACE_SCAN:         Optional[str] = None
    GSA_RESULT:        Optional[str] = None
    PDMA_RESULT:       Optional[str] = None
    RISK_RESULT:       Optional[str] = None
    IDENTITY_VERIFIED: Optional[str] = None


class IngestRequest(BaseModel):
    request:  Dict[str, Any]
    response: Dict[str, Any]


class CopilotMessage(BaseModel):
    role:    str
    content: str


class CopilotRequest(BaseModel):
    message:        str
    history:        List[CopilotMessage] = []
    transaction_id: Optional[str] = None
