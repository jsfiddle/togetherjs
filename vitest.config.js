import { defineConfig } from "vitest/config";

export default defineConfig({
  // Unit tests import modules directly rather than the built bundle, so the
  // same build-time substitutions build/build.mjs makes have to happen here.
  define: {
    __HUB_URL__: JSON.stringify("http://localhost:8787"),
    __GIT_COMMIT__: JSON.stringify("test"),
    __BASE_URL__: JSON.stringify("http://localhost:8099/dist"),
  },
  test: {
    include: ["tests/unit/**/*.test.js"],
    environment: "jsdom",
  },
});
