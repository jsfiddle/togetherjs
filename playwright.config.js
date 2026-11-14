import { defineConfig } from "@playwright/test";
import fs from "node:fs";

/* This dev container ships a Chromium that Playwright does not manage, at a
   stable symlink that tracks whichever build the image holds. Use it when it
   is there and let Playwright resolve its own browser otherwise (CI, or a
   normal checkout after `playwright install`). Do not name a build number
   here: it goes stale whenever the image is rebuilt. */
const candidates = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium"];
const executablePath = candidates.find((p) => p && fs.existsSync(p));

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
        launchOptions: {
          executablePath,
          args: [
            // The sandbox may route through an HTTPS proxy that would
            // intercept the loopback hub connection.
            "--no-proxy-server",
            // Fake devices and auto-granted permission, so getUserMedia
            // resolves headlessly. Note this container produces no devices
            // even with the flag set, so tests/e2e/fixtures.js also installs
            // canvas/WebAudio-backed tracks; keep both.
            "--use-fake-device-for-media-capture",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
});
