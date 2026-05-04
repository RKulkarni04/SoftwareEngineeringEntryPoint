module.exports = [
    {
      ignores: [
        "node_modules",
        "spec/support/jasmine.mjs"
      ]
    },
    {
      languageOptions: {
        ecmaVersion: 2021,
        sourceType: "commonjs"
      },
      rules: {
        "no-unused-vars": "warn",
        "no-console": "off"
      }
    }
  ];
