"""SQLite persistence layer using parameterized queries."""

import os
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "pocketledger.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
"""


def get_db_path() -> Path:
    """Resolve the database file at call time so tests can point elsewhere."""
    configured = os.environ.get("POCKETLEDGER_DB")
    return Path(configured).expanduser() if configured else DEFAULT_DB_PATH


def connect() -> sqlite3.Connection:
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def get_cursor() -> Iterator[sqlite3.Cursor]:
    connection = connect()
    try:
        yield connection.cursor()
        connection.commit()
    finally:
        connection.close()


def init_db() -> None:
    with get_cursor() as cursor:
        cursor.executescript(SCHEMA)


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def _where_clause(
    transaction_type: str | None, category: str | None
) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if transaction_type:
        clauses.append("type = ?")
        params.append(transaction_type)
    if category:
        clauses.append("category = ?")
        params.append(category)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return where, params


def list_transactions(
    transaction_type: str | None = None,
    category: str | None = None,
    limit: int = 500,
) -> list[dict[str, Any]]:
    where, params = _where_clause(transaction_type, category)
    params.append(limit)
    with get_cursor() as cursor:
        cursor.execute(
            f"""
            SELECT * FROM transactions
            {where}
            ORDER BY date DESC, id DESC
            LIMIT ?
            """,
            params,
        )
        return [row_to_dict(row) for row in cursor.fetchall()]


def get_transaction(transaction_id: int) -> dict[str, Any] | None:
    with get_cursor() as cursor:
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,))
        row = cursor.fetchone()
        return row_to_dict(row) if row else None


def create_transaction(data: dict[str, Any]) -> dict[str, Any]:
    transaction_date: date = data["date"]
    created_at = datetime.now().isoformat(timespec="seconds")
    with get_cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO transactions (type, amount_minor, category, description, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                data["type"],
                data["amount_minor"],
                data["category"],
                data.get("description", ""),
                transaction_date.isoformat(),
                created_at,
            ),
        )
        new_id = int(cursor.lastrowid or 0)
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (new_id,))
        row = cursor.fetchone()
        return row_to_dict(row)


def update_transaction(transaction_id: int, data: dict[str, Any]) -> dict[str, Any] | None:
    transaction_date: date = data["date"]
    with get_cursor() as cursor:
        cursor.execute(
            """
            UPDATE transactions
            SET type = ?, amount_minor = ?, category = ?, description = ?, date = ?
            WHERE id = ?
            """,
            (
                data["type"],
                data["amount_minor"],
                data["category"],
                data.get("description", ""),
                transaction_date.isoformat(),
                transaction_id,
            ),
        )
        if cursor.rowcount == 0:
            return None
        cursor.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,))
        row = cursor.fetchone()
        return row_to_dict(row) if row else None


def delete_transaction(transaction_id: int) -> bool:
    with get_cursor() as cursor:
        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        return cursor.rowcount > 0


def summary(currency: str) -> dict[str, Any]:
    with get_cursor() as cursor:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount_minor END), 0) AS income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor END), 0) AS expense,
                COUNT(*) AS count
            FROM transactions
            """
        )
        totals = cursor.fetchone()
        cursor.execute(
            """
            SELECT category, type, SUM(amount_minor) AS total, COUNT(*) AS count
            FROM transactions
            GROUP BY category, type
            ORDER BY total DESC, category ASC
            """
        )
        categories = cursor.fetchall()

    income = int(totals["income"])
    expense = int(totals["expense"])
    return {
        "currency": currency,
        "income_total_minor": income,
        "expense_total_minor": expense,
        "balance_minor": income - expense,
        "transaction_count": int(totals["count"]),
        "by_category": [
            {
                "category": row["category"],
                "type": row["type"],
                "total_minor": int(row["total"]),
                "transaction_count": int(row["count"]),
            }
            for row in categories
        ],
    }
