"""CRUD, filtering and validation tests for the transactions API."""

from datetime import date, timedelta

from fastapi.testclient import TestClient


def test_health_reports_ok(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_create_transaction(client: TestClient) -> None:
    response = client.post(
        "/api/transactions",
        json={
            "type": "income",
            "amount_minor": 250_000,
            "category": "salary",
            "description": "  October payroll  ",
            "date": "2026-10-30",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["type"] == "income"
    assert body["amount_minor"] == 250_000
    assert body["category"] == "Salary"
    assert body["description"] == "October payroll"
    assert body["date"] == "2026-10-30"


def test_list_orders_by_date_descending(client: TestClient, sample_transactions: list[dict]) -> None:
    response = client.get("/api/transactions")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 4
    dates = [item["date"] for item in body]
    assert dates == sorted(dates, reverse=True)


def test_filter_by_type_and_category(client: TestClient, sample_transactions: list[dict]) -> None:
    expenses = client.get("/api/transactions", params={"type": "expense"}).json()
    assert {item["type"] for item in expenses} == {"expense"}
    assert len(expenses) == 2

    food = client.get("/api/transactions", params={"category": "food"}).json()
    assert len(food) == 1
    assert food[0]["category"] == "Food"

    combined = client.get(
        "/api/transactions", params={"type": "income", "category": "Salary"}
    ).json()
    assert len(combined) == 1
    assert combined[0]["description"] == "Monthly salary"


def test_filter_rejects_unknown_category(client: TestClient, sample_transactions: list[dict]) -> None:
    response = client.get("/api/transactions", params={"category": "Crypto"})
    assert response.status_code == 422


def test_update_transaction(client: TestClient, sample_transactions: list[dict]) -> None:
    target = sample_transactions[2]
    response = client.put(
        f"/api/transactions/{target['id']}",
        json={
            "type": "expense",
            "amount_minor": 99_99,
            "category": "Transport",
            "description": "Bus fare",
            "date": "2026-10-08",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == target["id"]
    assert body["amount_minor"] == 9_999
    assert body["category"] == "Transport"
    assert body["description"] == "Bus fare"

    refreshed = client.get("/api/transactions").json()
    updated = next(item for item in refreshed if item["id"] == target["id"])
    assert updated["amount_minor"] == 9_999


def test_update_missing_transaction(client: TestClient) -> None:
    response = client.put(
        "/api/transactions/9999",
        json={
            "type": "income",
            "amount_minor": 100,
            "category": "Salary",
            "description": "",
            "date": "2026-10-01",
        },
    )
    assert response.status_code == 404


def test_delete_transaction(client: TestClient, sample_transactions: list[dict]) -> None:
    target = sample_transactions[0]
    response = client.delete(f"/api/transactions/{target['id']}")
    assert response.status_code == 204
    assert response.content == b""

    remaining = client.get("/api/transactions").json()
    assert len(remaining) == 3
    assert all(item["id"] != target["id"] for item in remaining)

    assert client.delete(f"/api/transactions/{target['id']}").status_code == 404


def test_delete_missing_transaction(client: TestClient) -> None:
    assert client.delete("/api/transactions/12345").status_code == 404


def test_invalid_amounts_are_rejected(client: TestClient) -> None:
    base = {
        "type": "expense",
        "category": "Food",
        "description": "",
        "date": "2026-10-10",
    }
    for amount in (0, -500, "12.50"):
        response = client.post("/api/transactions", json={**base, "amount_minor": amount})
        assert response.status_code == 422, amount


def test_invalid_type_and_category_are_rejected(client: TestClient) -> None:
    base = {
        "amount_minor": 500,
        "category": "Food",
        "description": "",
        "date": "2026-10-10",
    }
    assert client.post("/api/transactions", json={**base, "type": "transfer"}).status_code == 422
    assert (
        client.post("/api/transactions", json={**base, "type": "expense", "category": "Crypto"}).status_code
        == 422
    )


def test_missing_fields_and_future_dates_are_rejected(client: TestClient) -> None:
    assert client.post("/api/transactions", json={"type": "expense"}).status_code == 422

    future = (date.today() + timedelta(days=1)).isoformat()
    response = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount_minor": 500,
            "category": "Food",
            "description": "",
            "date": future,
        },
    )
    assert response.status_code == 422


def test_description_length_is_limited(client: TestClient) -> None:
    response = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount_minor": 500,
            "category": "Food",
            "description": "x" * 201,
            "date": "2026-10-10",
        },
    )
    assert response.status_code == 422
