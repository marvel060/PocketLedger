"""PocketLedger FastAPI application."""

import os
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware

import database
from models import (
    CATEGORIES,
    HealthResponse,
    Summary,
    Transaction,
    TransactionCreate,
    TransactionUpdate,
)


def get_currency() -> str:
    return os.environ.get("POCKETLEDGER_CURRENCY", "NGN").upper()


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.init_db()
    yield


app = FastAPI(
    title="PocketLedger API",
    description="A small income and expense tracker API.",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins = os.environ.get(
    "POCKETLEDGER_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def _normalize_filter_category(category: str | None) -> str | None:
    if category is None or category.strip() == "":
        return None
    canonical = next((c for c in CATEGORIES if c.lower() == category.strip().lower()), None)
    if canonical is None:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown category '{category}'",
        )
    return canonical


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        with database.get_cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
    return HealthResponse(status="ok", database="connected")


@app.get("/api/transactions", response_model=list[Transaction])
def list_transactions(
    type: Literal["income", "expense"] | None = Query(default=None),
    category: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=500, ge=1, le=1000),
) -> list[Transaction]:
    rows = database.list_transactions(
        transaction_type=type,
        category=_normalize_filter_category(category),
        limit=limit,
    )
    return [Transaction(**row) for row in rows]


@app.post(
    "/api/transactions",
    response_model=Transaction,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(payload: TransactionCreate) -> Transaction:
    row = database.create_transaction(payload.model_dump())
    return Transaction(**row)


@app.put("/api/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: int, payload: TransactionUpdate) -> Transaction:
    existing = database.get_transaction(transaction_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found",
        )
    row = database.update_transaction(transaction_id, payload.model_dump())
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found",
        )
    return Transaction(**row)


@app.delete(
    "/api/transactions/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_transaction(transaction_id: int) -> Response:
    if not database.delete_transaction(transaction_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction {transaction_id} not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/summary", response_model=Summary)
def get_summary() -> Summary:
    return Summary(**database.summary(get_currency()))


@app.get("/api/categories", response_model=list[str])
def get_categories() -> list[str]:
    return CATEGORIES
