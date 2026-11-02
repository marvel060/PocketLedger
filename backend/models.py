"""Pydantic models and validation rules for PocketLedger."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TransactionType = Literal["income", "expense"]

# Canonical category names. Values are normalized (case/spacing) before validation.
CATEGORIES = [
    "Salary",
    "Freelance",
    "Business",
    "Food",
    "Transport",
    "Housing",
    "Utilities",
    "Entertainment",
    "Health",
    "Shopping",
    "Education",
    "Savings",
    "Gifts",
    "Other",
]

_CATEGORY_LOOKUP = {category.lower(): category for category in CATEGORIES}


class TransactionBase(BaseModel):
    """Fields shared by create and update payloads."""

    model_config = ConfigDict(str_strip_whitespace=True)

    type: TransactionType
    amount_minor: int = Field(
        ...,
        gt=0,
        le=1_000_000_000_00,
        description="Amount in integer minor currency units (kobo/cents).",
    )
    category: str = Field(..., min_length=1, max_length=40)
    description: str = Field("", max_length=200)
    date: date

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        canonical = _CATEGORY_LOOKUP.get(value.strip().lower())
        if canonical is None:
            raise ValueError(
                f"Unknown category '{value}'. Allowed: {', '.join(CATEGORIES)}"
            )
        return canonical

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str) -> str:
        return value.strip()

    @field_validator("date")
    @classmethod
    def reject_future_date(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Transaction date cannot be in the future.")
        return value


class TransactionCreate(TransactionBase):
    """Payload for POST /api/transactions."""


class TransactionUpdate(TransactionBase):
    """Payload for PUT /api/transactions/{id} (full replacement)."""


class Transaction(TransactionBase):
    """A stored transaction."""

    id: int
    created_at: datetime


class CategoryTotal(BaseModel):
    category: str
    type: TransactionType
    total_minor: int
    transaction_count: int


class Summary(BaseModel):
    currency: str
    income_total_minor: int
    expense_total_minor: int
    balance_minor: int
    transaction_count: int
    by_category: list[CategoryTotal]


class HealthResponse(BaseModel):
    status: str
    database: str
