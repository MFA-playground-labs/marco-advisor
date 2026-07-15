import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_UI_BASE_URL ?? "http://127.0.0.1:3010";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "npm run dev -- -H 127.0.0.1 -p 3010",
    url: `${baseURL}/trips`,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
