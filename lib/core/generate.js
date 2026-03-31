"use strict";

const { lintMessage } = require("./lint.js");
const { generateCommitMessage } = require("./openai.js");
const {
  getStagedDiff,
  getStagedStatSummary,
  getScopeHints,
} = require("./git.js");

function buildFallbackMessage() {
  const stat = getStagedStatSummary();
  const summary = stat ? stat.split("\n")[0] || "staged changes" : "staged changes";
  return `chore: ${summary}`.slice(0, 100);
}

async function generateAndValidate(
  cwd = process.cwd(),
  { requireOpenAI = false } = {},
) {
  const diff = getStagedDiff(cwd);
  const hints = getScopeHints(cwd);
  if (requireOpenAI && !process.env.OPENAI_API_KEY) {
    const err = new Error(
      "OPENAI_API_KEY is not set. Add it to your environment or a .env file in the project root.",
    );
    err.code = "ENOKEY";
    throw err;
  }
  let message;
  try {
    if (!process.env.OPENAI_API_KEY) {
      message = buildFallbackMessage();
    } else {
      message = await generateCommitMessage(diff, hints);
    }
  } catch (e) {
    if (e.code === "ENOKEY") throw e;
    message = buildFallbackMessage();
  }
  let result = await lintMessage(message, cwd);
  if (result.valid) {
    return { message, warnings: [] };
  }
  const fallback = buildFallbackMessage();
  result = await lintMessage(fallback, cwd);
  if (result.valid) {
    return {
      message: fallback,
      warnings: ["Used fallback message after AI output failed commitlint rules."],
    };
  }
  const minimal = "chore: update staged changes";
  result = await lintMessage(minimal, cwd);
  if (result.valid) {
    return {
      message: minimal,
      warnings: ["Used generic fallback after validation failed."],
    };
  }
  const errors = [...result.errors, ...result.warnings]
    .map((x) => x.message)
    .filter(Boolean);
  throw new Error(
    `Commit message failed validation:\n${errors.join("\n") || result.input}`,
  );
}

module.exports = { generateAndValidate, buildFallbackMessage };
