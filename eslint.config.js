import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "src/vendor/**", "src/templates/generated.js", "site/**"],
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Substituted by build/build.mjs.
        __HUB_URL__: "readonly",
        __GIT_COMMIT__: "readonly",
        __BASE_URL__: "readonly",
        // Third-party globals the client integrates with when the host page
        // happens to provide them.
        CKEDITOR: "readonly",
        YT: "readonly",
        MozActivity: "readonly",
        // Published by the client itself, for the test harness / YouTube API.
        onYouTubeIframeAPIReady: "writable",
        TogetherJSTestSpy: "writable",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      eqeqeq: "off", // the ported code uses == widely; not worth the churn
      "no-console": "off",
    },
  },
  {
    files: ["build/**/*.mjs", "tests/**/*.js", "tests/**/*.mjs", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
    },
  },
];
