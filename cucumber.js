/**
 * Cucumber-js profiles. Requires the app at TEST_BASE_URL (default http://localhost:3000).
 *
 * - default: feature files that match the Puppeteer step definitions in features/step_definitions/steps.js
 * - wip: all .feature files (login/signup/security need additional step definitions)
 */
module.exports = {
  default: {
    paths: ["features/model_selection.feature", "features/iteration3.feature"],
    import: ["features/step_definitions/**/*.js"],
    tags: "not @named-ollama-models",
    publishQuiet: true,
  },
  "all-local-models": {
    paths: ["features/model_selection.feature", "features/iteration3.feature"],
    import: ["features/step_definitions/**/*.js"],
    publishQuiet: true,
  },
  wip: {
    paths: ["features/**/*.feature"],
    import: ["features/step_definitions/**/*.js"],
    publishQuiet: true,
  },
};
