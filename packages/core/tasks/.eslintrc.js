module.exports = {
  extends: "../../../.eslintrc.js",
  overrides: [{
    files: ["util.js", "config.js"],
    parserOptions: {
      sourceType: "module",
    }
  }],
};
