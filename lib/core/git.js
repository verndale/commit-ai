"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const GIT_DIFF_MAX_BUFFER = 10 * 1024 * 1024;

function execGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: GIT_DIFF_MAX_BUFFER,
    ...options,
  });
}

function getGitRoot(cwd = process.cwd()) {
  try {
    return execGit(["rev-parse", "--show-toplevel"], { cwd }).trim();
  } catch {
    return null;
  }
}

function assertInGitRepo(cwd = process.cwd()) {
  try {
    execGit(["rev-parse", "--git-dir"], { cwd });
  } catch {
    const err = new Error("Not a git repository (or git not available).");
    err.code = "ENOTGIT";
    throw err;
  }
}

function getStagedDiff(cwd = process.cwd()) {
  assertInGitRepo(cwd);
  return execGit(["diff", "--cached", "--no-color"], { cwd });
}

function getStagedStatSummary(cwd = process.cwd()) {
  assertInGitRepo(cwd);
  try {
    return execGit(["diff", "--cached", "--stat"], { cwd }).trim();
  } catch {
    return "";
  }
}

function hasStagedChanges(cwd = process.cwd()) {
  assertInGitRepo(cwd);
  const out = execGit(["diff", "--cached", "--name-only"], { cwd });
  return out.trim().length > 0;
}

/**
 * Generic scope hints: repo folder name, nearest package.json name, docs-only heuristic.
 */
function getScopeHints(cwd = process.cwd()) {
  const hints = [];
  const root = getGitRoot(cwd);
  if (root) {
    hints.push(`Repository root folder name: "${path.basename(root)}" (often a good scope candidate).`);
  }
  let dir = path.resolve(cwd);
  const rootPath = root ? path.resolve(root) : null;
  for (let i = 0; i < 6; i += 1) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name && typeof pkg.name === "string") {
          hints.push(`Nearest package.json name: "${pkg.name}" (use short scope, e.g. scope after / or last segment).`);
        }
      } catch {
        /* ignore */
      }
      break;
    }
    if (rootPath && dir === rootPath) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return hints;
}

function commitFromFile(message, cwd = process.cwd()) {
  execFileSync("git", ["commit", "-F", "-"], {
    cwd,
    input: message,
    encoding: "utf8",
    maxBuffer: GIT_DIFF_MAX_BUFFER,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

module.exports = {
  GIT_DIFF_MAX_BUFFER,
  execGit,
  getGitRoot,
  assertInGitRepo,
  getStagedDiff,
  getStagedStatSummary,
  hasStagedChanges,
  getScopeHints,
  commitFromFile,
};
