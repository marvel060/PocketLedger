import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against the production build and a real FastAPI server.
 * The backend uses a disposable database in /tmp so local ledger data is safe.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "bash -c 'cd .. && rm -f /tmp/pocketledger-playwright.db && POCKETLEDGER_DB=/tmp/pocketledger-playwright.db POCKETLEDGER_CORS_ORIGINS=http://127.0.0.1:4173,http://localhost:4173 backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000'",
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
