"""
Decision Graph Engine — pure Python implementation.
Builds a DAG of the IDPF decision pipeline and computes:
  - PageRank (node influence)
  - Betweenness Centrality (bottleneck detection)
  - Community Detection via label propagation (failure clusters)
  - Critical Paths (highest-rejection paths)
"""
from typing import Dict, List, Any, Set, Tuple
from collections import defaultdict, deque
import math


# ── Fixed pipeline node order ─────────────────────────────────────────────────
PIPELINE_NODES = [
    {"id": "REQUEST_IN",        "label": "Request Received",        "type": "entry",    "category": "ingestion"},
    {"id": "DOC_VERIFY",        "label": "Document Verification",   "type": "service",  "category": "identity"},
    {"id": "FACE_SCAN",         "label": "Face Scan",               "type": "service",  "category": "biometric"},
    {"id": "GSA_CHECK",         "label": "GSA Address Check",       "type": "rule",     "category": "address"},
    {"id": "RULE_7",            "label": "Rule 7 — CMRA",           "type": "rule",     "category": "address"},
    {"id": "RULE_8",            "label": "Rule 8 — PBSA",           "type": "rule",     "category": "address"},
    {"id": "RULE_9",            "label": "Rule 9 — POBox",          "type": "rule",     "category": "address"},
    {"id": "RULE_6",            "label": "Rule 6 — Comm Error",     "type": "rule",     "category": "reliability"},
    {"id": "RULE_3",            "label": "Rule 3 — KOEC0039+X",     "type": "rule",     "category": "fault"},
    {"id": "RULE_5",            "label": "Rule 5 — KOEC0039",       "type": "rule",     "category": "fault"},
    {"id": "PDMA_CHECK",        "label": "PDMA Compliance",         "type": "service",  "category": "compliance"},
    {"id": "RISK_EVAL",         "label": "Risk Evaluation",         "type": "service",  "category": "risk"},
    {"id": "POPULATE_RESULT",   "label": "populateResult()",        "type": "logic",    "category": "post-process"},
    {"id": "VERIFIED",          "label": "Identity Verified",       "type": "terminal", "category": "outcome"},
    {"id": "NOT_VERIFIED",      "label": "Not Verified",            "type": "terminal", "category": "outcome"},
]

NODE_IDS = {n["id"] for n in PIPELINE_NODES}


def _tx_path(tx: Dict) -> List[Tuple[str, str]]:
    """Return list of (source, target) edge pairs for a single transaction."""
    edges = []
    edges.append(("REQUEST_IN", "DOC_VERIFY"))

    doc_pass = tx["doc_result"] == "IDENTITY_DOCUMENT_VALIDATED"
    if not doc_pass:
        edges.append(("DOC_VERIFY", "NOT_VERIFIED"))
        return edges

    edges.append(("DOC_VERIFY", "FACE_SCAN"))
    edges.append(("FACE_SCAN", "GSA_CHECK"))

    rules = [r.strip() for r in tx["rules_fired"].split(",") if r.strip()]
    stop = False

    if tx["cmra_flag"]:
        edges.append(("GSA_CHECK", "RULE_7"))
        edges.append(("RULE_7", "NOT_VERIFIED"))
        stop = True
    elif tx["pbsa_flag"]:
        edges.append(("GSA_CHECK", "RULE_8"))
        edges.append(("RULE_8", "NOT_VERIFIED"))
        stop = True
    elif tx["pobox_flag"]:
        edges.append(("GSA_CHECK", "RULE_9"))
        edges.append(("RULE_9", "NOT_VERIFIED"))
        stop = True
    elif tx["comm_error"]:
        edges.append(("GSA_CHECK", "RULE_6"))
        edges.append(("RULE_6", "NOT_VERIFIED"))
        stop = True
    elif tx["fault_code"] == "KOEC0039" and tx.get("fault_sub_code") == "X":
        edges.append(("GSA_CHECK", "RULE_3"))
        edges.append(("RULE_3", "NOT_VERIFIED"))
        stop = True
    elif tx["fault_code"] == "KOEC0039":
        edges.append(("GSA_CHECK", "RULE_5"))
        edges.append(("RULE_5", "PDMA_CHECK"))

    if not stop and tx["fault_code"] != "KOEC0039":
        edges.append(("GSA_CHECK", "PDMA_CHECK"))

    if not stop:
        pdma = tx.get("pdma_result")
        if pdma == "ADDRESS_CIP_COMPLIANT":
            edges.append(("PDMA_CHECK", "RISK_EVAL"))
            risk = tx.get("risk_result")
            if risk == "ALLOW":
                edges.append(("RISK_EVAL", "POPULATE_RESULT"))
                edges.append(("POPULATE_RESULT", "VERIFIED"))
            else:
                edges.append(("RISK_EVAL", "NOT_VERIFIED"))
        else:
            edges.append(("PDMA_CHECK", "NOT_VERIFIED"))

    return edges


def build_decision_graph(transactions: List[Dict]) -> Dict[str, Any]:
    """Build full decision graph with node stats and edge weights."""
    node_pass: Dict[str, int] = defaultdict(int)
    node_fail: Dict[str, int] = defaultdict(int)
    node_total: Dict[str, int] = defaultdict(int)
    edge_pass: Dict[Tuple[str, str], int] = defaultdict(int)
    edge_fail: Dict[Tuple[str, str], int] = defaultdict(int)

    for tx in transactions:
        path_edges = _tx_path(tx)
        is_verified = tx["final_result"] == "IDENTITY_VERIFIED"
        visited: Set[str] = set()
        for src, tgt in path_edges:
            for n in (src, tgt):
                if n not in visited:
                    node_total[n] += 1
                    if is_verified:
                        node_pass[n] += 1
                    else:
                        node_fail[n] += 1
                    visited.add(n)
            key = (src, tgt)
            if is_verified:
                edge_pass[key] += 1
            else:
                edge_fail[key] += 1

    nodes = []
    for n in PIPELINE_NODES:
        nid = n["id"]
        total = node_total.get(nid, 0)
        passed = node_pass.get(nid, 0)
        failed = node_fail.get(nid, 0)
        nodes.append({
            **n,
            "volume":       total,
            "pass_count":   passed,
            "fail_count":   failed,
            "success_rate": round(passed / total * 100, 1) if total else 0.0,
            "failure_rate": round(failed / total * 100, 1) if total else 0.0,
        })

    all_edge_keys = set(edge_pass.keys()) | set(edge_fail.keys())
    edges = []
    for src, tgt in sorted(all_edge_keys):
        p = edge_pass.get((src, tgt), 0)
        f = edge_fail.get((src, tgt), 0)
        total = p + f
        edges.append({
            "source":       src,
            "target":       tgt,
            "count":        total,
            "pass_count":   p,
            "fail_count":   f,
            "success_rate": round(p / total * 100, 1) if total else 0.0,
            "failure_rate": round(f / total * 100, 1) if total else 0.0,
        })

    return {"nodes": nodes, "edges": edges}


def compute_pagerank(graph: Dict[str, Any], damping: float = 0.85, iterations: int = 100) -> List[Dict]:
    """Standard iterative PageRank on the decision graph."""
    nodes = [n["id"] for n in graph["nodes"] if n["volume"] > 0]
    if not nodes:
        return []

    # Build adjacency: incoming edges per node
    in_edges: Dict[str, List[Tuple[str, int]]] = {n: [] for n in nodes}
    out_count: Dict[str, int] = {n: 0 for n in nodes}

    for e in graph["edges"]:
        src, tgt = e["source"], e["target"]
        if src in in_edges and tgt in in_edges:
            in_edges[tgt].append((src, e["count"]))
            out_count[src] += e["count"]

    n = len(nodes)
    pr = {node: 1.0 / n for node in nodes}

    for _ in range(iterations):
        new_pr: Dict[str, float] = {}
        for node in nodes:
            rank_sum = sum(
                pr[src] * (cnt / max(out_count[src], 1))
                for src, cnt in in_edges[node]
            )
            new_pr[node] = (1 - damping) / n + damping * rank_sum
        pr = new_pr

    # Normalize to 0-1
    max_pr = max(pr.values()) if pr else 1
    results = sorted(
        [{"node_id": n, "label": _node_label(graph, n), "score": round(pr[n] / max_pr, 4),
          "raw_score": round(pr[n], 6)} for n in nodes],
        key=lambda x: -x["score"]
    )
    return results


def compute_betweenness(graph: Dict[str, Any]) -> List[Dict]:
    """Betweenness centrality via BFS over all source-target pairs."""
    nodes = [n["id"] for n in graph["nodes"] if n["volume"] > 0]
    if not nodes:
        return []

    # Build adjacency list (directed, weighted by count)
    adj: Dict[str, List[str]] = {n: [] for n in nodes}
    for e in graph["edges"]:
        if e["source"] in adj and e["target"] in adj:
            adj[e["source"]].append(e["target"])

    betweenness: Dict[str, float] = {n: 0.0 for n in nodes}

    for src in nodes:
        # BFS from src
        visited = {src: 0}
        queue = deque([src])
        path_count: Dict[str, int] = {src: 1}
        predecessors: Dict[str, List[str]] = {n: [] for n in nodes}
        order = []

        while queue:
            v = queue.popleft()
            order.append(v)
            for w in adj[v]:
                if w not in visited:
                    visited[w] = visited[v] + 1
                    queue.append(w)
                    path_count[w] = 0
                if visited.get(w, -1) == visited[v] + 1:
                    path_count[w] = path_count.get(w, 0) + path_count[v]
                    predecessors[w].append(v)

        # Back-propagation
        delta: Dict[str, float] = {n: 0.0 for n in nodes}
        for w in reversed(order):
            for v in predecessors[w]:
                if path_count[w] > 0:
                    delta[v] += (path_count[v] / path_count[w]) * (1 + delta[w])
            if w != src:
                betweenness[w] += delta[w]

    n = len(nodes)
    norm = (n - 1) * (n - 2) if n > 2 else 1
    max_bc = max(betweenness.values()) if betweenness else 1

    return sorted(
        [{"node_id": nid, "label": _node_label(graph, nid),
          "score": round(betweenness[nid] / max(max_bc, 1e-9), 4),
          "raw_score": round(betweenness[nid] / norm, 6)} for nid in nodes],
        key=lambda x: -x["score"]
    )


def detect_communities(graph: Dict[str, Any]) -> List[Dict]:
    """Label propagation community detection."""
    nodes = [n["id"] for n in graph["nodes"] if n["volume"] > 0]
    if not nodes:
        return []

    adj: Dict[str, Set[str]] = {n: set() for n in nodes}
    for e in graph["edges"]:
        if e["source"] in adj and e["target"] in adj:
            adj[e["source"]].add(e["target"])
            adj[e["target"]].add(e["source"])

    labels = {n: i for i, n in enumerate(nodes)}

    for _ in range(20):
        changed = False
        for n in nodes:
            if not adj[n]:
                continue
            neighbor_labels: Dict[int, int] = {}
            for nb in adj[n]:
                lbl = labels[nb]
                neighbor_labels[lbl] = neighbor_labels.get(lbl, 0) + 1
            best = max(neighbor_labels, key=lambda k: neighbor_labels[k])
            if labels[n] != best:
                labels[n] = best
                changed = True
        if not changed:
            break

    # Group by community
    communities: Dict[int, List[str]] = defaultdict(list)
    for n, lbl in labels.items():
        communities[lbl].append(n)

    result = []
    for idx, (lbl, members) in enumerate(sorted(communities.items(), key=lambda x: -len(x[1]))):
        fail_counts = []
        for m in members:
            node_data = next((nd for nd in graph["nodes"] if nd["id"] == m), None)
            if node_data:
                fail_counts.append(node_data.get("fail_count", 0))
        total_failures = sum(fail_counts)
        result.append({
            "community_id":    idx,
            "members":         members,
            "member_labels":   [_node_label(graph, m) for m in members],
            "size":            len(members),
            "total_failures":  total_failures,
            "description":     f"Cluster {idx + 1}: {', '.join([_node_label(graph, m) for m in members[:3]])}",
        })
    return result


def compute_critical_paths(transactions: List[Dict], top_n: int = 8) -> List[Dict]:
    """Find top-N decision paths by failure volume."""
    path_failures: Dict[str, int] = defaultdict(int)
    path_total: Dict[str, int] = defaultdict(int)

    for tx in transactions:
        edges = _tx_path(tx)
        # Build a string path key from node sequence
        seen = []
        for src, tgt in edges:
            if not seen:
                seen.append(src)
            if tgt not in seen:
                seen.append(tgt)
        path_key = " → ".join(seen)
        path_total[path_key] += 1
        if tx["final_result"] != "IDENTITY_VERIFIED":
            path_failures[path_key] += 1

    all_paths = set(path_total.keys()) | set(path_failures.keys())
    results = []
    for pk in all_paths:
        fails = path_failures.get(pk, 0)
        total = path_total.get(pk, 1)
        results.append({
            "path":          pk,
            "total":         total,
            "failures":      fails,
            "passes":        total - fails,
            "failure_rate":  round(fails / total * 100, 1) if total else 0.0,
            "pct_of_all_failures": 0.0,
        })

    total_failures = sum(r["failures"] for r in results)
    for r in results:
        r["pct_of_all_failures"] = round(r["failures"] / max(total_failures, 1) * 100, 1)

    return sorted(results, key=lambda x: -x["failures"])[:top_n]


def _node_label(graph: Dict, node_id: str) -> str:
    for n in graph["nodes"]:
        if n["id"] == node_id:
            return n.get("label", node_id)
    return node_id
