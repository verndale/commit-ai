"use strict";

/** @see @commitlint/types RuleConfigSeverity — avoid require() (package is ESM-only). */
const ERROR = 2;

/**
 * Single source of truth for commit types, lengths, and scope guidance.
 * Used by the commitlint preset, AI prompts, and programmatic validation.
 */

const COMMIT_TYPES = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
  "style",
  "test",
];

const HEADER_MAX_LENGTH = 100;
const BODY_MAX_LINE_LENGTH = 100;
const FOOTER_MAX_LINE_LENGTH = 100;

/** Optional scope: lowercase segments, slashes allowed (e.g. repo-name, pkg/core). */
const SCOPE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/**
 * Rules merged on top of @commitlint/config-conventional (same keys we customize).
 */
function getCommitlintRuleOverrides() {
  return {
    "type-enum": [ERROR, "always", COMMIT_TYPES],
    "header-max-length": [ERROR, "always", HEADER_MAX_LENGTH],
    "body-max-line-length": [ERROR, "always", BODY_MAX_LINE_LENGTH],
    "footer-max-line-length": [ERROR, "always", FOOTER_MAX_LINE_LENGTH],
  };
}

/**
 * Human + model instructions derived from the same constants as commitlint.
 */
function getPromptInstructions() {
  return [
    "Write a Conventional Commit message for the staged changes.",
    "",
    `Allowed types (exactly one, lowercase): ${COMMIT_TYPES.join(", ")}.`,
    "Use optional scope in parentheses when it helps: lowercase, hyphens for multi-word, slashes for monorepo paths (e.g. feat(ui): …, fix(api/auth): …). Omit scope if unclear.",
    "Subject: imperative mood, no trailing period, ASCII unless the codebase already uses non-ASCII in similar messages.",
    `First line (header) must be at most ${HEADER_MAX_LENGTH} characters including type, optional scope, and subject.`,
    "Breaking changes: append ! after scope or type (e.g. feat!: … or feat(api)!: …) and explain in body with BREAKING CHANGE: footer if appropriate.",
    `Body: optional; if present, blank line after header; wrap lines at ${BODY_MAX_LINE_LENGTH} characters.`,
    `Footer: optional (issues, metadata); wrap at ${FOOTER_MAX_LINE_LENGTH} characters per line.`,
    "Output ONLY the commit message text — no markdown fences, no commentary.",
  ].join("\n");
}

module.exports = {
  COMMIT_TYPES,
  HEADER_MAX_LENGTH,
  BODY_MAX_LINE_LENGTH,
  FOOTER_MAX_LINE_LENGTH,
  SCOPE_PATTERN,
  getCommitlintRuleOverrides,
  getPromptInstructions,
};
