import "./styles.css";
import { ApiError, PocketLedgerApi } from "./api";
import type {
  Summary,
  Transaction,
  TransactionFilters,
  TransactionPayload,
  TransactionType,
} from "./types";

const config = {
  apiBaseUrl:
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    "http://localhost:8000",
  currency:
    (import.meta.env.VITE_CURRENCY as string | undefined)?.trim() || "NGN",
  locale:
    (import.meta.env.VITE_LOCALE as string | undefined)?.trim() || "en-NG",
};

const api = new PocketLedgerApi(config.apiBaseUrl);

interface State {
  transactions: Transaction[];
  summary: Summary | null;
  categories: string[];
  filters: TransactionFilters;
  editingId: number | null;
  loadingTransactions: boolean;
  loadError: string | null;
  submitting: boolean;
}

const state: State = {
  transactions: [],
  summary: null,
  categories: [],
  filters: { type: "all", category: "all" },
  editingId: null,
  loadingTransactions: false,
  loadError: null,
  submitting: false,
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const moneyFormatter = new Intl.NumberFormat(config.locale, {
  style: "currency",
  currency: config.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat(config.locale, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatMoney(minor: number): string {
  return moneyFormatter.format(minor / 100);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return dateFormatter.format(new Date(year, month - 1, day));
}

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function parseAmountToMinor(raw: string): number | null {
  const value = raw.trim().replace(/,/g, "");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

// ---------------------------------------------------------------- DOM refs

const summaryIncome = el<HTMLParagraphElement>("summary-income");
const summaryExpense = el<HTMLParagraphElement>("summary-expense");
const summaryBalance = el<HTMLParagraphElement>("summary-balance");
const summaryIncomeMeta = el<HTMLParagraphElement>("summary-income-meta");
const summaryExpenseMeta = el<HTMLParagraphElement>("summary-expense-meta");
const summaryBalanceMeta = el<HTMLParagraphElement>("summary-balance-meta");
const lastUpdated = el<HTMLParagraphElement>("last-updated");
const apiStatus = el<HTMLSpanElement>("api-status");
const apiStatusText = el<HTMLSpanElement>("api-status-text");

const formCard = el<HTMLElement>("form-card");
const form = el<HTMLFormElement>("transaction-form");
const formTitle = el<HTMLHeadingElement>("form-title");
const formEyebrow = el<HTMLParagraphElement>("form-eyebrow");
const formError = el<HTMLParagraphElement>("form-error");
const submitButton = el<HTMLButtonElement>("submit-button");
const submitLabel = el<HTMLSpanElement>("submit-label");
const submitSpinner = el<HTMLSpanElement>("submit-spinner");
const cancelEdit = el<HTMLButtonElement>("cancel-edit");
const amountInput = el<HTMLInputElement>("amount");
const categorySelect = el<HTMLSelectElement>("category");
const dateInput = el<HTMLInputElement>("date");
const descriptionInput = el<HTMLInputElement>("description");
const currencyPrefix = el<HTMLSpanElement>("currency-prefix");

const filterType = el<HTMLSelectElement>("filter-type");
const filterCategory = el<HTMLSelectElement>("filter-category");
const clearFilters = el<HTMLButtonElement>("clear-filters");
const transactionList = el<HTMLUListElement>("transaction-list");
const ledgerFeedback = el<HTMLDivElement>("ledger-feedback");
const transactionCount = el<HTMLSpanElement>("transaction-count");

const breakdown = el<HTMLDivElement>("breakdown");
const breakdownCount = el<HTMLSpanElement>("breakdown-count");
const toastRegion = el<HTMLDivElement>("toast-region");

// ---------------------------------------------------------------- UI helpers

function toast(message: string, variant: "success" | "error" = "success"): void {
  const node = document.createElement("div");
  node.className = `toast ${variant}`;
  node.textContent = message;
  toastRegion.append(node);
  window.setTimeout(() => {
    node.classList.add("leaving");
    window.setTimeout(() => node.remove(), 250);
  }, 3_800);
}

function setApiStatus(stateName: "online" | "offline" | "loading"): void {
  apiStatus.dataset.state = stateName;
  apiStatusText.textContent =
    stateName === "online"
      ? "API connected"
      : stateName === "offline"
        ? "API offline"
        : "Connecting…";
}

function setFormError(message: string | null): void {
  formError.textContent = message ?? "";
  formError.hidden = message === null;
}

function setSubmitting(busy: boolean): void {
  state.submitting = busy;
  submitButton.disabled = busy;
  submitSpinner.classList.toggle("hidden", !busy);
  submitLabel.textContent = busy
    ? "Saving…"
    : state.editingId !== null
      ? "Save changes"
      : "Add transaction";
}

function currentType(): TransactionType {
  const checked = form.querySelector<HTMLInputElement>(
    'input[name="type"]:checked',
  );
  return checked?.value === "income" ? "income" : "expense";
}

function updateSubmitLabel(): void {
  if (state.submitting) return;
  submitLabel.textContent =
    state.editingId !== null
      ? "Save changes"
      : currentType() === "income"
        ? "Add income"
        : "Add expense";
  submitButton.classList.toggle("income-mode", currentType() === "income");
}

// ---------------------------------------------------------------- rendering

function renderSummary(): void {
  const summary = state.summary;
  if (!summary) {
    summaryIncome.textContent = "—";
    summaryExpense.textContent = "—";
    summaryBalance.textContent = "—";
    return;
  }
  summaryIncome.textContent = formatMoney(summary.income_total_minor);
  summaryExpense.textContent = formatMoney(summary.expense_total_minor);
  summaryBalance.textContent = formatMoney(summary.balance_minor);
  summaryBalance.classList.toggle("negative", summary.balance_minor < 0);

  summaryIncomeMeta.textContent =
    summary.transaction_count === 0
      ? "Money coming in"
      : `Across ${pluralize(summary.transaction_count, "entry", "entries")}`;
  summaryExpenseMeta.textContent =
    summary.expense_total_minor === 0
      ? "Money going out"
      : `Share of ${formatMoney(
          summary.income_total_minor + summary.expense_total_minor,
        )} moved`;
  summaryBalanceMeta.textContent =
    summary.balance_minor < 0
      ? "You have spent more than you earned"
      : summary.transaction_count === 0
        ? "Income minus expenses"
        : `Saved from ${formatMoney(summary.income_total_minor)} income`;
}

function transactionItem(transaction: Transaction): string {
  const isIncome = transaction.type === "income";
  const sign = isIncome ? "+" : "−";
  const description =
    transaction.description.trim() || `${transaction.category} entry`;
  return `
    <li class="transaction ${transaction.type}" data-id="${transaction.id}">
      <span class="transaction-badge" aria-hidden="true">${isIncome ? "↑" : "↓"}</span>
      <div class="transaction-body">
        <p class="transaction-title">${escapeHtml(description)}</p>
        <p class="transaction-meta">
          <span class="pill">${escapeHtml(transaction.category)}</span>
          <span class="dot" aria-hidden="true">·</span>
          <time datetime="${escapeHtml(transaction.date)}">${escapeHtml(
            formatDate(transaction.date),
          )}</time>
        </p>
      </div>
      <span class="transaction-amount ${transaction.type}">
        ${sign}${escapeHtml(formatMoney(transaction.amount_minor))}
      </span>
      <div class="transaction-actions">
        <button type="button" class="icon-btn" data-action="edit" data-id="${
          transaction.id
        }" aria-label="Edit ${escapeHtml(description)}">✎</button>
        <button type="button" class="icon-btn danger" data-action="delete" data-id="${
          transaction.id
        }" aria-label="Delete ${escapeHtml(description)}">✕</button>
      </div>
    </li>`;
}

function renderTransactions(): void {
  transactionCount.textContent = pluralize(
    state.transactions.length,
    "entry",
    "entries",
  );

  if (state.loadingTransactions) {
    ledgerFeedback.innerHTML = "";
    ledgerFeedback.hidden = true;
    transactionList.innerHTML = Array.from(
      { length: 3 },
      () => `
      <li class="transaction skeleton" aria-hidden="true">
        <span class="skeleton-block circle"></span>
        <div class="transaction-body">
          <span class="skeleton-block line wide"></span>
          <span class="skeleton-block line"></span>
        </div>
      </li>`,
    ).join("");
    return;
  }

  if (state.loadError) {
    transactionList.innerHTML = "";
    ledgerFeedback.hidden = false;
    ledgerFeedback.innerHTML = `
      <div class="error-state">
        <p class="empty-title">Could not load transactions</p>
        <p class="empty-copy">${escapeHtml(state.loadError)}</p>
        <button type="button" class="btn ghost small" data-action="retry">Try again</button>
      </div>`;
    return;
  }

  if (state.transactions.length === 0) {
    transactionList.innerHTML = "";
    const filtered =
      state.filters.type !== "all" || state.filters.category !== "all";
    ledgerFeedback.hidden = false;
    ledgerFeedback.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">🧾</span>
        <p class="empty-title">${
          filtered ? "No matching transactions" : "Your ledger is empty"
        }</p>
        <p class="empty-copy">${
          filtered
            ? "Try a different type or category filter to see more entries."
            : "Add your first income or expense using the form to start tracking."
        }</p>
      </div>`;
    return;
  }

  ledgerFeedback.hidden = true;
  ledgerFeedback.innerHTML = "";
  transactionList.innerHTML = state.transactions.map(transactionItem).join("");
}

function groupCategories(summary: Summary): Array<{
  category: string;
  type: TransactionType;
  total_minor: number;
  transaction_count: number;
}> {
  return [...summary.by_category].sort((a, b) => b.total_minor - a.total_minor);
}

function renderBreakdown(): void {
  const summary = state.summary;
  if (!summary || summary.by_category.length === 0) {
    breakdown.innerHTML = `
      <div class="empty-state compact">
        <span class="empty-icon" aria-hidden="true">📊</span>
        <p class="empty-title">Nothing to break down yet</p>
        <p class="empty-copy">Add a few transactions and your category totals will appear here.</p>
      </div>`;
    breakdownCount.textContent = "0 categories";
    return;
  }

  const groups = groupCategories(summary);
  breakdownCount.textContent = pluralize(
    groups.length,
    "category",
    "categories",
  );
  const max = Math.max(...groups.map((group) => group.total_minor), 1);
  const totalMoved =
    summary.income_total_minor + summary.expense_total_minor || 1;

  breakdown.innerHTML = groups
    .map((group) => {
      const width = Math.max(2, Math.round((group.total_minor / max) * 100));
      const share = Math.round((group.total_minor / totalMoved) * 100);
      const shareLabel = share === 0 ? "<1" : String(share);
      return `
        <div class="breakdown-row" role="listitem">
          <div class="breakdown-label">
            <span class="pill">${escapeHtml(group.category)}</span>
            <span class="breakdown-type ${group.type}">${group.type}</span>
          </div>
          <div class="breakdown-visual">
            <div class="bar-track" role="img" aria-label="${escapeHtml(
              group.category,
            )} ${group.type}: ${shareLabel}% of tracked money">
              <span class="bar-fill ${group.type}" style="width:${width}%"></span>
            </div>
            <span class="breakdown-share">${shareLabel}%</span>
          </div>
          <span class="breakdown-amount">${escapeHtml(
            formatMoney(group.total_minor),
          )}</span>
          <span class="breakdown-count">${pluralize(
            group.transaction_count,
            "entry",
            "entries",
          )}</span>
        </div>`;
    })
    .join("");
}

function renderAll(): void {
  renderSummary();
  renderTransactions();
  renderBreakdown();
  lastUpdated.textContent = state.summary
    ? `Updated ${new Date().toLocaleTimeString(config.locale, {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "";
}

// ---------------------------------------------------------------- data flow

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

async function loadTransactions(): Promise<void> {
  state.loadingTransactions = true;
  state.loadError = null;
  renderTransactions();
  try {
    state.transactions = await api.listTransactions(state.filters);
  } catch (error) {
    state.transactions = [];
    state.loadError = describeError(error);
    setApiStatus("offline");
    throw error;
  } finally {
    state.loadingTransactions = false;
    renderTransactions();
  }
}

async function loadSummary(): Promise<void> {
  state.summary = await api.getSummary();
  renderSummary();
  renderBreakdown();
}

async function refreshData(options: { transactionsOnly?: boolean } = {}): Promise<void> {
  try {
    if (options.transactionsOnly) {
      await loadTransactions();
    } else {
      await Promise.all([loadTransactions(), loadSummary()]);
    }
    setApiStatus("online");
    renderAll();
  } catch {
    // Individual loaders render their own error state.
  }
}

async function bootstrap(): Promise<void> {
  setApiStatus("loading");
  try {
    const health = await api.health();
    setApiStatus(health.status === "ok" ? "online" : "offline");
  } catch {
    setApiStatus("offline");
  }

  try {
    const categories = await api.listCategories();
    state.categories = categories;
    populateCategoryOptions(categories);
  } catch {
    state.categories = [];
  }

  await refreshData();
}

// ---------------------------------------------------------------- form logic

function populateSelect(
  select: HTMLSelectElement,
  categories: string[],
  allLabel: string,
): void {
  const previous = select.value;
  const options =
    allLabel === ""
      ? [`<option value="">Select a category</option>`]
      : [`<option value="all">${allLabel}</option>`];
  for (const category of categories) {
    options.push(`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`);
  }
  select.innerHTML = options.join("");
  if (previous && [...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function populateCategoryOptions(categories: string[]): void {
  populateSelect(categorySelect, categories, "");
  populateSelect(filterCategory, categories, "All categories");
  if (state.filters.category !== "all") filterCategory.value = state.filters.category;
}

function setFormMode(transaction: Transaction | null): void {
  state.editingId = transaction?.id ?? null;
  cancelEdit.classList.toggle("hidden", transaction === null);
  formEyebrow.textContent = transaction ? "Editing entry" : "New entry";
  formTitle.textContent = transaction ? "Edit transaction" : "Add a transaction";
  formCard.classList.toggle("editing", transaction !== null);

  if (transaction) {
    const typeRadio = form.querySelector<HTMLInputElement>(
      `input[name="type"][value="${transaction.type}"]`,
    );
    if (typeRadio) typeRadio.checked = true;
    amountInput.value = (transaction.amount_minor / 100).toFixed(2);
    categorySelect.value = transaction.category;
    dateInput.value = transaction.date;
    descriptionInput.value = transaction.description;
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    amountInput.focus({ preventScroll: true });
  } else {
    form.reset();
    const expenseRadio = form.querySelector<HTMLInputElement>(
      'input[name="type"][value="expense"]',
    );
    if (expenseRadio) expenseRadio.checked = true;
    dateInput.value = todayIso();
    dateInput.max = todayIso();
  }
  setFormError(null);
  updateSubmitLabel();
}

function resetForm(): void {
  setFormMode(null);
  dateInput.value = todayIso();
  dateInput.max = todayIso();
}

function readForm(): TransactionPayload | string {
  const type = currentType();
  const amountMinor = parseAmountToMinor(amountInput.value);
  if (amountMinor === null || amountMinor <= 0) {
    return "Enter an amount greater than zero (up to 2 decimal places).";
  }
  if (!categorySelect.value) {
    return "Choose a category for this transaction.";
  }
  if (!dateInput.value) {
    return "Pick a date for this transaction.";
  }
  if (dateInput.value > todayIso()) {
    return "The date cannot be in the future.";
  }
  return {
    type,
    amount_minor: amountMinor,
    category: categorySelect.value,
    description: descriptionInput.value.trim(),
    date: dateInput.value,
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.submitting) return;

  const payload = readForm();
  if (typeof payload === "string") {
    setFormError(payload);
    return;
  }

  setFormError(null);
  setSubmitting(true);
  try {
    if (state.editingId !== null) {
      await api.updateTransaction(state.editingId, payload);
      toast("Transaction updated.");
    } else {
      await api.createTransaction(payload);
      toast("Transaction added.");
    }
    resetForm();
    await refreshData();
    setApiStatus("online");
  } catch (error) {
    setFormError(describeError(error));
    if (error instanceof ApiError && error.status === 0) setApiStatus("offline");
  } finally {
    setSubmitting(false);
    updateSubmitLabel();
  }
});

form.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.name === "type") {
    updateSubmitLabel();
  }
});

cancelEdit.addEventListener("click", () => {
  resetForm();
  toast("Edit cancelled.");
});

filterType.addEventListener("change", () => {
  state.filters.type =
    filterType.value === "income" || filterType.value === "expense"
      ? filterType.value
      : "all";
  void refreshData({ transactionsOnly: true });
});

filterCategory.addEventListener("change", () => {
  state.filters.category = filterCategory.value || "all";
  void refreshData({ transactionsOnly: true });
});

clearFilters.addEventListener("click", () => {
  state.filters = { type: "all", category: "all" };
  filterType.value = "all";
  filterCategory.value = "all";
  void refreshData({ transactionsOnly: true });
});

ledgerFeedback.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('[data-action="retry"]')) {
    void refreshData();
  }
});

transactionList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  if (button.dataset.action === "edit") {
    setFormMode(transaction);
    return;
  }

  if (button.dataset.action === "delete") {
    const label =
      transaction.description.trim() || `${transaction.category} entry`;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    button.disabled = true;
    try {
      await api.deleteTransaction(id);
      if (state.editingId === id) resetForm();
      toast("Transaction deleted.");
      await refreshData();
    } catch (error) {
      button.disabled = false;
      toast(describeError(error), "error");
    }
  }
});

// ---------------------------------------------------------------- init

const prefixPart = moneyFormatter
  .formatToParts(0)
  .find((part) => part.type === "currency");
currencyPrefix.textContent = prefixPart?.value ?? config.currency;
dateInput.value = todayIso();
dateInput.max = todayIso();

const year = document.querySelector<HTMLElement>(".footer-meta");
if (year) year.dataset.year = String(new Date().getFullYear());

void bootstrap();
