"""Pydantic domain models for request/response validation."""
from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class RuleOverrides(BaseModel):
    rule_7_cmra_continue:   bool = False
    rule_8_pbsa_continue:   bool = False
    rule_9_pobox_continue:  bool = False
    rule_6_fallthrough:     bool = False
    rule_3_fallthrough:     bool = False
    populate_result_relax:  bool = False
    koec0039_A_severity:    str  = 'WARN'
    koec0039_B_severity:    str  = 'STOP'
    koec0039_H_severity:    str  = 'WARN'
    koec0039_M_severity:    str  = 'WARN'
    koec0039_S_severity:    str  = 'WARN'
    koec0039_Z_severity:    str  = 'STOP'


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
