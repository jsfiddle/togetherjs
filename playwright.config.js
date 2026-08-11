import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: "http://localhost:8099",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        // Chromium is preinstalled in this environment; never run
        // `playwright install`.
        launchOptions: {
          executablePath:
            process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
          args: [
            // The sandbox may route through an HTTPS proxy that would
            // intercept the loopback hub connection.
            "--no-proxy-server",
            // Synthetic camera/mic so getUserMedia resolves headlessly, and
            // no permission prompt to click through.
            "--use-fake-device-for-media-capture",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
});
