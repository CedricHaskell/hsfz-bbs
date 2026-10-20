import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3211",
    launchOptions: process.env.HSFZ_TEST_BROWSER ? { executablePath: process.env.HSFZ_TEST_BROWSER } : {},
  },
  webServer: {
    command: "node --import tsx tests/e2e/serve.mts",
    url: "http://127.0.0.1:3211/login",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
