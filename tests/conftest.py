"""Shared pytest fixtures. Every test runs against a fresh temporary database."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture()
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("POCKETLEDGER_DB", str(tmp_path / "pocketledger-test.db"))
    monkeypatch.setenv("POCKETLEDGER_CURRENCY", "NGN")
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def sample_transactions(client: TestClient) -> list[dict]:
    payloads = [
        {
            "type": "income",
            "amount_minor": 500_000_00,
            "category": "Salary",
            "description": "Monthly salary",
            "date": "2026-10-01",
        },
        {
            "type": "expense",
            "amount_minor": 120_000_00,
            "category": "Housing",
            "description": "Rent",
            "date": "2026-10-02",
        },
        {
            "type": "expense",
            "amount_minor": 15_250_50,
            "category": "Food",
            "description": "Groceries",
            "date": "2026-10-05",
        },
        {
            "type": "income",
            "amount_minor": 60_000_00,
            "category": "Freelance",
            "description": "Design project",
            "date": "2026-10-07",
        },
    ]
    created = []
    for payload in payloads:
        response = client.post("/api/transactions", json=payload)
        assert response.status_code == 201, response.text
        created.append(response.json())
    return created
