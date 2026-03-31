"use strict";

const { getCommitlintRuleOverrides } = require("./rules.js");

module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: getCommitlintRuleOverrides(),
};
