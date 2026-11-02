"""Summary, balance and category breakdown tests."""

from fastapi.testclient import TestClient


def test_empty_summary(client: TestClient) -> None:
    response = client.get("/api/summary")
    assert response.status_code == 200
    assert response.json() == {
        "currency": "NGN",
        "income_total_minor": 0,
        "expense_total_minor": 0,
        "balance_minor": 0,
        "transaction_count": 0,
        "by_category": [],
    }


def test_summary_totals_and_balance(
    client: TestClient, sample_transactions: list[dict]
) -> None:
    body = client.get("/api/summary").json()

    # Income: 500,000.00 + 60,000.00 = 560,000.00
    assert body["income_total_minor"] == 560_000_00
    # Expenses: 120,000.00 + 15,250.50 = 135,250.50
    assert body["expense_total_minor"] == 135_250_50
    assert body["balance_minor"] == 560_000_00 - 135_250_50
    assert body["transaction_count"] == 4


def test_category_breakdown(client: TestClient, sample_transactions: list[dict]) -> None:
    body = client.get("/api/summary").json()
    by_category = {
        (item["category"], item["type"]): item for item in body["by_category"]
    }

    assert by_category[("Salary", "income")]["total_minor"] == 500_000_00
    assert by_category[("Freelance", "income")]["total_minor"] == 60_000_00
    assert by_category[("Housing", "expense")]["total_minor"] == 120_000_00
    assert by_category[("Food", "expense")]["total_minor"] == 15_250_50
    assert by_category[("Food", "expense")]["transaction_count"] == 1

    totals = [item["total_minor"] for item in body["by_category"]]
    assert totals == sorted(totals, reverse=True)


def test_summary_handles_repeated_categories(client: TestClient) -> None:
    for amount in (10, 20, 35):
        client.post(
            "/api/transactions",
            json={
                "type": "expense",
                "amount_minor": amount,
                "category": "Food",
                "description": "",
                "date": "2026-10-10",
            },
        )

    body = client.get("/api/summary").json()
    food = next(item for item in body["by_category"] if item["category"] == "Food")
    assert food["total_minor"] == 65
    assert food["transaction_count"] == 3
    # Integer minor units avoid floating-point drift.
    assert body["expense_total_minor"] == 65
    assert body["balance_minor"] == -65


def test_summary_reflects_updates_and_deletes(
    client: TestClient, sample_transactions: list[dict]
) -> None:
    client.delete(f"/api/transactions/{sample_transactions[0]['id']}")
    client.put(
        f"/api/transactions/{sample_transactions[1]['id']}",
        json={
            "type": "expense",
            "amount_minor": 1_000_00,
            "category": "Housing",
            "description": "Rent increase",
            "date": "2026-10-02",
        },
    )

    body = client.get("/api/summary").json()
    assert body["income_total_minor"] == 60_000_00
    assert body["expense_total_minor"] == 100_000 + 15_250_50
    assert body["transaction_count"] == 3
    assert body["balance_minor"] == 60_000_00 - (100_000 + 15_250_50)
