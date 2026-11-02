# PocketLedger — v0.1.0 Project Report

> A complete, local-first income and expense tracker built with FastAPI, SQLite,
> TypeScript and Vite.

| | |
| --- | --- |
| **Version** | `v0.1.0` |
| **Status** | Published, CI-verified and released |
| **Branch** | `main` |
| **Repository** | <https://github.com/marvel060/PocketLedger> |
| **Release** | <https://github.com/marvel060/PocketLedger/releases/tag/v0.1.0> |
| **Release commit** | `a1d2434343dd2f9bfd79a69d526f3d3b9489ea4e` |
| **Latest CI** | ✅ Success — [run 41419629969](https://github.com/marvel060/PocketLedger/actions/runs/41419629969) |
| **Owner** | `marvel060` |
| **Report date** | 2 November 2026 |

---

## Contents

1. [Application overview](#application-overview)
2. [Features implemented](#features-implemented)
3. [API endpoints](#api-endpoints)
4. [Folder structure](#folder-structure)
5. [GitHub publication](#github-publication)
6. [CI results](#ci-results)
7. [Browser testing](#browser-testing)
8. [Screenshots](#screenshots)
9. [Local startup](#local-startup)
10. [Release](#release)
11. [Known limitations](#known-limitations)

---

## Application overview

PocketLedger is a local-first personal finance dashboard. A strict-TypeScript
Vite frontend talks to a FastAPI + SQLite API. Amounts are stored as integer
minor units (kobo), summarized server-side, and displayed through
`Intl.NumberFormat` in a mobile-first responsive interface.

- **Frontend:** HTML5, CSS3, TypeScript (strict), Vite
- **Backend:** Python 3.11+, FastAPI, Pydantic, Uvicorn
- **Database:** SQLite through Python's built-in `sqlite3`, parameterized SQL
- **Tests:** pytest, FastAPI `TestClient`, Playwright/Chromium
- **CI:** GitHub Actions — backend tests, frontend build, browser tests
- **Scope:** No authentication, paid APIs, bank integrations, Docker, or
  external services. **Not publicly deployed.**

### Feature summary

| Area | What works |
| --- | --- |
| Transactions | Create, edit, delete, list; amount, date, category, description, type |
| Categories | 14 canonical categories, case/whitespace normalized |
| Summary | Total income, total expenses, current balance, entry counts |
| Filtering | By type and category, with reset |
| Breakdown | CSS bars with percentage shares; nonzero shares below 1% show `<1%` |
| States | Loading skeletons, empty, validation, retryable errors, API status |
| Accessibility | Labeled controls, keyboard-friendly toggle, `aria-live`, skip link |
| Money | Integer minor units end-to-end; `Intl.NumberFormat` display |
| Configuration | API base URL, currency (`NGN` default), locale |
| Quality | 18 backend tests, 10 browser tests, strict typecheck, production build |

---

## Features implemented

- Add income and expense transactions.
- Edit and delete existing transactions, with confirmation before deletion.
- Record amount, date, description, type, and category.
- 14 normalized categories.
- Display total income, total expenses, and current balance.
- Filter transaction history by type and category.
- Category breakdown with CSS progress bars and percentage shares.
- SQLite persistence with parameterized queries.
- Mobile-first responsive layout with breakpoints at 560 px, 760 px and 1024 px.
- Sticky transaction form beside the ledger on desktop; stacked on phones.
- Loading skeletons, empty states, inline validation, retry actions and toasts.
- API connection status pill in the header.
- Accessible labels, visible focus, `aria-live` feedback and reduced-motion support.
- Configurable API base URL, currency and locale.
- Backend validation for dates, amounts, categories, descriptions and types.
- MIT license, README, `.gitignore`, CI, and browser regression tests.

---

## API endpoints

Base URL: `http://localhost:8000`

| Method | Endpoint | Purpose | Responses |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Service and database status | `200`, `503` |
| `GET` | `/api/transactions` | List transactions, newest first | `200`, `422` |
| `POST` | `/api/transactions` | Create a transaction | `201`, `422` |
| `PUT` | `/api/transactions/{id}` | Replace a transaction | `200`, `404`, `422` |
| `DELETE` | `/api/transactions/{id}` | Delete a transaction | `204`, `404` |
| `GET` | `/api/summary` | Totals, balance, category breakdown | `200` |
| `GET` | `/api/categories` | Allowed category names | `200` |

### Filters for `GET /api/transactions`

| Parameter | Values | Notes |
| --- | --- | --- |
| `type` | `income` or `expense` | Optional |
| `category` | Any canonical category | Optional, case-insensitive |
| `limit` | `1`–`1000` | Optional, default `500` |

### Example transaction payload

```json
{
  "type": "expense",
  "amount_minor": 125050,
  "category": "Food",
  "description": "Groceries",
  "date": "2026-10-31"
}
```

### Validation rules

- `type` must be `income` or `expense`.
- `amount_minor` must be a positive integer (maximum `100,000,000,000`).
- `category` must be one of the allowed categories.
- `description` is trimmed and limited to 200 characters.
- `date` must be a valid ISO date and cannot be in the future.
- `PUT` requires the full payload.

### Money handling

Amounts travel through the API, SQLite and JavaScript state as **integer minor
units** (kobo for NGN). Decimal input such as `1,250.50` becomes `125050` using
string arithmetic, never `parseFloat`. Currency symbols are display-only and
are never used in calculations.

---

## Folder structure

```text
PocketLedger/
├── backend/
│   ├── main.py             # FastAPI routes, CORS, lifespan
│   ├── database.py         # schema, queries, summary aggregation
│   ├── models.py           # Pydantic models and validation
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.ts         # UI state, rendering, form/filter logic
│   │   ├── api.ts          # typed API client
│   │   ├── types.ts
│   │   └── styles.css
│   ├── e2e/
│   │   └── pocketledger.spec.ts
│   ├── playwright.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── tests/
│   ├── conftest.py
│   ├── test_transactions.py
│   └── test_summary.py
├── docs/screenshots/       # desktop-1440, tablet-768, mobile-390
├── .github/workflows/ci.yml
├── pytest.ini
├── README.md
├── LICENSE
└── REPORT.md
```

---

## GitHub publication

### Identity and authorization

| Check | Result |
| --- | --- |
| Git remote | `https://github.com/marvel060/PocketLedger` |
| Authenticated account | `marvel060` |
| Repository owner | `marvel060` |
| Viewer permission | `ADMIN` |
| Visibility | Public |
| Default branch | `main` |

### Push results

| Push | Range | Result |
| --- | --- | --- |
| Initial publication | `b3e3d47..b6a02b2` | Success, fast-forward |
| CI, browser tests, screenshots | `b6a02b2..dc77bdb` | Success, fast-forward |
| Final documentation, report and version metadata | `dc77bdb..a1d2434` | Success, fast-forward |

- No force-push or history rewrite was used.
- Remote history was verified as an ancestor before the first push
  (`0` remote-only commits, `4` local-only commits).
- No unrelated remote changes were overwritten.

V0.1.0 commit history:

| Commit | Message |
| --- | --- |
| `dc37957` | feat: add FastAPI and SQLite backend for the ledger |
| `982ed47` | feat: build responsive TypeScript expense dashboard |
| `dabb6fa` | test: cover the API against temporary databases and add CI |
| `b6a02b2` | docs: document setup, API usage and testing |
| `54f23a4` | fix: correct edit highlight, mobile form layout and share rounding |
| `29ec0dd` | test: add Playwright browser coverage and CI job |
| `dc77bdb` | docs: add authentic screenshots and local data guidance |
| `a1d2434` | docs: publish the v0.1.0 report and align version metadata |

**Release commit SHA:** `a1d2434343dd2f9bfd79a69d526f3d3b9489ea4e`

The annotated `v0.1.0` tag resolves to this exact commit, which passed all
three CI jobs before the release was created. A subsequent docs-only commit
refreshed this report; it does not change the released application code. The
latest docs commit is visible in `git log` on `main`.

---

## CI results

Workflow: <https://github.com/marvel060/PocketLedger/actions/workflows/ci.yml>

### Final release-validation run

**URL:** <https://github.com/marvel060/PocketLedger/actions/runs/41419629969>
**SHA:** `a1d2434343dd2f9bfd79a69d526f3d3b9489ea4e` (release commit)
**Conclusion:** **Success**

| Job | Result | Details |
| --- | --- | --- |
| Backend tests (Python 3.11) | ✅ Success | **18 passed** in 0.34 s |
| Frontend typecheck & build (Node 22) | ✅ Success | `tsc --noEmit` and Vite build |
| Browser tests (Playwright / Chromium) | ✅ Success | **10 passed** in 7.6 s |

### Run for the browser-test commit

**URL:** <https://github.com/marvel060/PocketLedger/actions/runs/41419303265>
**SHA:** `dc77bdb003d4e5dd77fa01f7e3e9d8501c28399a`
**Conclusion:** **Success**

| Job | Result | Details |
| --- | --- | --- |
| Backend tests (Python 3.11) | ✅ Success | **18 passed** in 1.34 s |
| Frontend typecheck & build (Node 22) | ✅ Success | `tsc --noEmit` and Vite build |
| Browser tests (Playwright / Chromium) | ✅ Success | **10 passed** in 7.8 s |

### Earlier publication run

**URL:** <https://github.com/marvel060/PocketLedger/actions/runs/41417935237>
**SHA:** `b6a02b2d235b69558f2350563ad3ca750e0094b8`
**Conclusion:** Success — backend pytest and frontend build each passed.

### CI notes

- Only non-failing annotations remain: GitHub's Node.js 20 deprecation notice
  for `actions/checkout@v4`, `actions/setup-node@v4` and
  `actions/setup-python@v5`.
- Playwright failure artifacts (report and traces) upload automatically when
  the browser job fails.

---

## Browser testing

Real Chromium automation via Playwright. The suite starts Uvicorn with a
disposable database in `/tmp` and the production preview build, then exercises
the UI exactly as a user would.

| Test | Result |
| --- | --- |
| Empty ledger + live API connection | ✅ |
| Validation errors for incomplete submissions | ✅ |
| Add income and update summary | ✅ |
| Add expenses, balance math and category breakdown | ✅ |
| Filter by category and type | ✅ |
| Edit a transaction and recalculate totals | ✅ |
| Delete a transaction with confirmation | ✅ |
| Persistence after page refresh | ✅ |
| Responsive layouts at 390 / 768 / 1440 px, no horizontal overflow | ✅ |
| API connection failure and retry recovery | ✅ |

**Local run:** 10 passed (11.4 s).
**Final release CI run:** 10 passed (7.6 s).
**Screenshots:** generated from this suite, in `docs/screenshots/`.

### Defects found and fixed

1. **Edit highlight applied to the wrong element.** `setFormMode` added the
   `.editing` class to the `<form>` instead of the `#form-card` section, so the
   visual edit state never appeared. Fixed and covered by the edit test.
2. **Nonzero category rendered as `0%`.** Small expense shares rounded down to
   zero. Shares now display `<1%` and the breakdown test asserts it.
3. **Truncated category selector on narrow phones.** The amount field row now
   stacks at 420 px and below; verified by the 390 px capture.

No API defects were found during browser testing; backend behavior matched the
unit suite.

---

## Screenshots

All captures are authentic Playwright output using disposable demo data.

| Viewport | File |
| --- | --- |
| Desktop 1440 px | [`docs/screenshots/desktop-1440.png`](docs/screenshots/desktop-1440.png) |
| Tablet 768 px | [`docs/screenshots/tablet-768.png`](docs/screenshots/tablet-768.png) |
| Mobile 390 px | [`docs/screenshots/mobile-390.png`](docs/screenshots/mobile-390.png) |

The images are embedded in the README and show summary cards, the transaction
form, filters, transaction history and the category breakdown.

---

## Local startup

### Backend

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate     # Windows: backend\.venv\Scripts\activate
pip install -r backend/requirements.txt

cd backend
uvicorn main:app --reload --port 8000
```

- API: <http://localhost:8000>
- Swagger docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/api/health>
- Database: `backend/pocketledger.db` (created on first run, gitignored)

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # optional
npm run dev
```

Open <http://localhost:5173>. Set `VITE_API_BASE_URL` in `frontend/.env` if the
API runs elsewhere.

### Checks

```bash
python -m pytest                       # 18 backend tests
cd frontend
npm run typecheck                      # strict TypeScript
npm run build                          # production build
npx playwright install chromium        # first run
npx playwright install-deps chromium   # Linux libraries, first run
npm run test:e2e                       # 10 browser tests
```

### Local data

Transactions live only in `backend/pocketledger.db` on your machine. The file is
ignored by Git, never uploaded, and can be deleted while the backend is stopped
to reset the ledger. Tests use separate temporary databases and never touch
real data.

---

## Release

| Field | Value |
| --- | --- |
| Version | `v0.1.0` |
| Tag | `v0.1.0` (annotated) |
| Release URL | <https://github.com/marvel060/PocketLedger/releases/tag/v0.1.0> |
| Target | `main` |
| Target commit | `a1d2434343dd2f9bfd79a69d526f3d3b9489ea4e` |
| Tag verification | Resolves to `a1d2434` — matches the release commit |
| State | Published — not a draft, not a prerelease |
| Published at | 2026-11-02 09:20:15 UTC |
| Deployment | None by design |

### Release summary

PocketLedger v0.1.0 is the first stable release: a responsive expense dashboard
with full transaction CRUD, category filters, server-computed summaries,
integer money handling, SQLite persistence, 18 backend tests, 10 Chromium
browser tests, and CI covering pytest, TypeScript, the production build, and
end-to-end behavior.

**Not deployed.** The API has no authentication; exposing a writable finance
API publicly would be unsafe without access controls.

---

## Known limitations

- **Do not expose this API publicly.** No authentication or access control
  exists; anyone reaching a writable deployment could read or modify the ledger.
- Single-user, local-only design; no multi-device sync or accounts.
- Transaction list capped by the server-side `limit` (default 500); no
  pagination UI.
- No recurring transactions, budgets or advanced reporting.
- Dates are plain calendar dates without timezone conversion.
- Browser coverage is Chromium only.
- GitHub CI shows non-blocking Node.js 20 deprecation notices for action
  versions used.
- Not intended for real banking, tax or accounting use.

---

*PocketLedger v0.1.0 · MIT licensed · Report prepared and refreshed on 2 November 2026.*
