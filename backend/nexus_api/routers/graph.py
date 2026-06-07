"""
Decision Graph Router.
Exposes graph analytics: nodes/edges, PageRank, Betweenness, Communities, Critical Paths.
"""
from fastapi import APIRouter
from ..database import query
from ..engines.graph_engine import (
    build_decision_graph, compute_pagerank,
    compute_betweenness, detect_communities, compute_critical_paths,
)

router = APIRouter()


def _get_txs():
    return query("SELECT * FROM transactions")


@router.get("/graph")
def get_decision_graph():
    return build_decision_graph(_get_txs())


@router.get("/pagerank")
def get_pagerank():
    graph = build_decision_graph(_get_txs())
    return compute_pagerank(graph)


@router.get("/betweenness")
def get_betweenness():
    graph = build_decision_graph(_get_txs())
    return compute_betweenness(graph)


@router.get("/communities")
def get_communities():
    graph = build_decision_graph(_get_txs())
    return detect_communities(graph)


@router.get("/critical-paths")
def get_critical_paths():
    return compute_critical_paths(_get_txs())
