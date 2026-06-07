"""Simulation router — What-If, sensitivity sweep, scenario management."""
import json
import uuid
import datetime
from fastapi import APIRouter, HTTPException
from typing import List

from ..database import query, execute
from ..engines.whatif_engine import run_simulation, sensitivity_sweep, SCENARIO_CARDS
from ..models.domain import SimulationRequest, SaveScenarioRequest

router = APIRouter()


@router.post("/run")
def run_sim(request: SimulationRequest):
    txs = query("SELECT * FROM transactions")
    overrides = request.rule_overrides.model_dump()
    result = run_simulation(txs, overrides, n_iterations=request.n_iterations)
    return result


@router.get("/sensitivity")
def get_sensitivity():
    txs = query("SELECT * FROM transactions")
    return sensitivity_sweep(txs)


@router.get("/scenarios")
def get_scenarios():
    saved = query("SELECT * FROM simulations ORDER BY created_at DESC")
    preset = [{"id": s["id"], "name": s["name"], "description": s["description"],
               "overrides": s["overrides"], "type": "preset"} for s in SCENARIO_CARDS]
    user_saved = [{"id": s["id"], "name": s["name"],
                   "rule_overrides": json.loads(s["rule_overrides"]),
                   "baseline_rate":  s["baseline_rate"],
                   "simulated_rate": s["simulated_rate"],
                   "delta":          s["delta"],
                   "delta_absolute": s["delta_absolute"],
                   "ci_95_low":      s["ci_95_low"],
                   "ci_95_high":     s["ci_95_high"],
                   "created_at":     s["created_at"],
                   "type": "saved"} for s in saved]
    return {"presets": preset, "saved": user_saved}


@router.post("/save")
def save_scenario(request: SaveScenarioRequest):
    sid = str(uuid.uuid4())
    overrides_json = json.dumps(request.rule_overrides.model_dump())
    result = request.result
    execute(
        """INSERT INTO simulations (id, name, rule_overrides, baseline_rate, simulated_rate,
           delta, delta_absolute, ci_95_low, ci_95_high, affected_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (sid, request.name, overrides_json,
         result.get("baseline_pass_rate"), result.get("simulated_pass_rate"),
         result.get("delta"), result.get("delta_absolute"),
         result.get("ci_95_low"), result.get("ci_95_high"),
         result.get("affected_count"),
         datetime.datetime.utcnow().isoformat())
    )
    return {"id": sid, "status": "saved"}


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: str):
    execute("DELETE FROM simulations WHERE id = ?", (scenario_id,))
    return {"status": "deleted"}
