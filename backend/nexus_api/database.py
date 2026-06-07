"""
SQLite in-memory database layer.
Single persistent connection seeded at startup with 1500 synthetic transactions.
"""
import sqlite3
import threading
from typing import List, Dict, Any

from .seed import generate_transactions

# Single in-memory connection shared across all threads
_conn: sqlite3.Connection | None = None
_lock = threading.Lock()


def get_conn() -> sqlite3.Connection:
    return _conn  # type: ignore[return-value]


def dict_row_factory(cursor: sqlite3.Cursor, row: tuple) -> Dict[str, Any]:
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}


def init_db() -> None:
    global _conn
    _conn = sqlite3.connect(":memory:", check_same_thread=False)
    _conn.row_factory = dict_row_factory
    _conn.execute("PRAGMA journal_mode=WAL")

    _conn.executescript("""
    CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT PRIMARY KEY,
        event_date      TEXT NOT NULL,
        doc_result      TEXT,
        face_result     TEXT,
        cmra_flag       INTEGER DEFAULT 0,
        pbsa_flag       INTEGER DEFAULT 0,
        pobox_flag      INTEGER DEFAULT 0,
        comm_error      INTEGER DEFAULT 0,
        fault_code      TEXT,
        fault_sub_code  TEXT,
        gsa_result      TEXT,
        pdma_result     TEXT,
        risk_result     TEXT,
        final_result    TEXT NOT NULL,
        rules_fired     TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date   ON transactions(event_date);
    CREATE INDEX IF NOT EXISTS idx_tx_result ON transactions(final_result);
    CREATE INDEX IF NOT EXISTS idx_tx_rules  ON transactions(rules_fired);

    CREATE TABLE IF NOT EXISTS simulations (
        id              TEXT PRIMARY KEY,
        name            TEXT,
        rule_overrides  TEXT NOT NULL,
        baseline_rate   REAL,
        simulated_rate  REAL,
        delta           REAL,
        delta_absolute  INTEGER,
        ci_95_low       REAL,
        ci_95_high      REAL,
        affected_count  INTEGER,
        created_at      TEXT NOT NULL
    );
    """)

    # Seed transactions
    rows = generate_transactions(1500)
    _conn.executemany(
        """INSERT OR IGNORE INTO transactions
           (id, event_date, doc_result, face_result, cmra_flag, pbsa_flag, pobox_flag,
            comm_error, fault_code, fault_sub_code, gsa_result, pdma_result,
            risk_result, final_result, rules_fired)
           VALUES (:id,:event_date,:doc_result,:face_result,:cmra_flag,:pbsa_flag,
                   :pobox_flag,:comm_error,:fault_code,:fault_sub_code,:gsa_result,
                   :pdma_result,:risk_result,:final_result,:rules_fired)""",
        rows
    )
    _conn.commit()
    count = _conn.execute("SELECT COUNT(*) as c FROM transactions").fetchone()['c']
    print(f"[nexus-db] Seeded {count} transactions into in-memory SQLite")


def query(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with _lock:
        return _conn.execute(sql, params).fetchall()  # type: ignore[union-attr]


def query_one(sql: str, params: tuple = ()) -> Dict[str, Any] | None:
    with _lock:
        return _conn.execute(sql, params).fetchone()  # type: ignore[union-attr]


def execute(sql: str, params: tuple = ()) -> None:
    with _lock:
        _conn.execute(sql, params)  # type: ignore[union-attr]
        _conn.commit()  # type: ignore[union-attr]
