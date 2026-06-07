"""
Population Intelligence Router.
"""
from fastapi import APIRouter, Query
from ..database import query
from ..engines.population_engine import (
    segment_population, compute_funnel_by_rule,
    compute_treemap_data, compute_segment_heatmap, compute_all_segments,
    SEGMENT_DIMENSIONS,
)

router = APIRouter()


def _get_txs():
    return query("SELECT * FROM transactions")


@router.get("/segments")
def get_segments(dimension: str = Query(default="gsa_result")):
    if dimension not in SEGMENT_DIMENSIONS:
        dimension = "gsa_result"
    return segment_population(_get_txs(), dimension)


@router.get("/all-segments")
def get_all_segments():
    return compute_all_segments(_get_txs())


@router.get("/funnel")
def get_funnel():
    return compute_funnel_by_rule(_get_txs())


@router.get("/treemap")
def get_treemap():
    return compute_treemap_data(_get_txs())


@router.get("/heatmap")
def get_heatmap():
    return compute_segment_heatmap(_get_txs())
