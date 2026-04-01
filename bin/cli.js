#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

require("../lib/load-project-env.js").loadProjectEnv();

const { generateAndValidate } = require("../lib/core/generate.js");
const {
  assertInGitRepo,
  hasStagedChanges,
  commitFromFile,
} = require("../lib/core/git.js");
const { getProviderNames, hasApiKey } = require("../lib/providers/index.js");
const { formatCommitMessage, ok, warn: fmtWarn, fail, info, createSpinner, bold, dim, cyan, green } = require("../lib/core/format.js");
const { interactiveCommit } = require("../lib/core/interactive.js");

function presetPath() {
  return path.join(__dirname, "..", "lib", "commitlint-preset.cjs");
}

function commitlintCliPath() {
  return require.resolve("@commitlint/cli/cli.js");
}

function printHelp() {
  process.stdout.write(`${bold("commit-ai")} — AI-assisted conventional commits with bundled commitlint

${bold("Usage:")}
  commit-ai run [options]
  commit-ai prepare-commit-msg <file> [source]
  commit-ai lint --edit <file>
  commit-ai config [--init]
  commit-ai hooks install

${bold("Commands:")}
  ${green("run")}                  Generate a message from the staged diff and run git commit.
  ${green("prepare-commit-msg")}   Git hook: fill an empty commit message file.
  ${green("lint")}                 Run commitlint with the bundled config (for commit-msg hook).
  ${green("config")}               Show resolved configuration (or --init to create config file).
  ${green("hooks")}                Install git hooks (commit-ai hooks install).

${bold("Run Options:")}
  --dry-run            Generate and display the message without committing.
  -i, --interactive    Review the message before committing (accept/edit/regenerate/cancel).

${bold("Environment:")}
  COMMIT_AI_PROVIDER   Provider: ${getProviderNames().join(", ")} (default: openai).
  COMMIT_AI_API_KEY    API key (or use provider-specific: OPENAI_API_KEY, ANTHROPIC_API_KEY).
  COMMIT_AI_MODEL      Model override (default depends on provider).
  COMMIT_AI_BASE_URL   Custom API base URL.

${bold("Provider-specific:")}
  OPENAI_API_KEY              OpenAI API key.
  ANTHROPIC_API_KEY           Anthropic API key.
  AZURE_OPENAI_ENDPOINT       Azure OpenAI endpoint URL.
  AZURE_OPENAI_API_KEY        Azure OpenAI API key.
  AZURE_OPENAI_DEPLOYMENT     Azure deployment name.
  AZURE_OPENAI_API_VERSION    Azure API version.

Loads ${dim(".env")} then ${dim(".env.local")} from the current working directory (${dim(".env.local")} overrides).
`);
}

function parseRunArgs(argv) {
  const flags = { dryRun: false, interactive: false };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    if (arg === "-i" || arg === "--interactive") flags.interactive = true;
  }
  return flags;
}

function parseLintArgv(argv) {
  const i = argv.indexOf("--edit");
  if (i === -1 || !argv[i + 1]) {
    throw new Error("Missing --edit <file> (example: ai-commit lint --edit \"$1\")");
  }
  return { file: argv[i + 1] };
}

function stripGitComments(text) {
  return text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
}

async function cmdRun(flags) {
  assertInGitRepo();
  if (!hasStagedChanges()) {
    fail("No staged changes. Stage files before running commit-ai.");
    process.exit(1);
  }

  const providerName = process.env.COMMIT_AI_PROVIDER || "openai";
  const spinner = createSpinner(`Generating commit message via ${providerName}...`);

  let result;
  try {
    result = await generateAndValidate(process.cwd(), {
      requireOpenAI: true,
    });
  } finally {
    spinner.stop();
  }

  const { message, warnings } = result;

  if (flags.dryRun) {
    for (const w of warnings) fmtWarn(w);
    info("Dry run — message not committed:");
    process.stderr.write("\n");
    process.stderr.write(formatCommitMessage(message));
    process.stderr.write("\n");
    return;
  }

  if (flags.interactive) {
    await interactiveCommit({
      message,
      warnings,
      regenerate: () => generateAndValidate(process.cwd(), { requireOpenAI: true }),
      commit: commitFromFile,
      cwd: process.cwd(),
    });
    return;
  }

  for (const w of warnings) fmtWarn(w);
  process.stderr.write("\n");
  process.stderr.write(formatCommitMessage(message));
  process.stderr.write("\n\n");
  commitFromFile(message);
  ok("Committed successfully.");
}

async function cmdPrepareCommitMsg(file, source) {
  if (source === "merge" || source === "squash") {
    process.exit(0);
  }
  assertInGitRepo();
  const raw = fs.readFileSync(file, "utf8");
  const cleaned = stripGitComments(raw).trim();
  if (cleaned.length > 0) {
    process.exit(0);
  }
  if (!hasStagedChanges()) {
    process.exit(0);
  }
  const { message, warnings } = await generateAndValidate(process.cwd(), {
    requireOpenAI: false,
  });
  for (const w of warnings) {
    process.stderr.write(`warning: ${w}\n`);
  }
  fs.writeFileSync(file, message, "utf8");
}

function cmdLint(editFile) {
  const abs = path.isAbsolute(editFile)
    ? editFile
    : path.join(process.cwd(), editFile);
  const r = spawnSync(
    process.execPath,
    [
      commitlintCliPath(),
      "--edit",
      abs,
      "--config",
      presetPath(),
    ],
    { stdio: "inherit", cwd: process.cwd() },
  );
  process.exit(r.status ?? 1);
}

function cmdConfig(argv) {
  if (argv.includes("--init")) {
    const configPath = path.join(process.cwd(), ".commit-airc.json");
    if (fs.existsSync(configPath)) {
      info(`Config file already exists: ${configPath}`);
      return;
    }
    const defaultConfig = {
      provider: "openai",
      model: "gpt-4o-mini",
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + "\n", "utf8");
    ok(`Created ${configPath}`);
    return;
  }

  const providerName = process.env.COMMIT_AI_PROVIDER || "openai";
  const model = process.env.COMMIT_AI_MODEL || "(provider default)";
  const baseUrl = process.env.COMMIT_AI_BASE_URL || "(default)";

  const maskKey = (key) => {
    if (!key) return "(not set)";
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "…" + key.slice(-4);
  };

  const config = {
    provider: providerName,
    model,
    baseUrl,
    apiKey: maskKey(
      process.env.COMMIT_AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.AZURE_OPENAI_API_KEY,
    ),
    apiKeyAvailable: hasApiKey(),
    availableProviders: getProviderNames(),
  };

  if (providerName === "azure-openai") {
    config.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || "(not set)";
    config.azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || "(not set)";
    config.azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || "(default)";
  }

  process.stdout.write(JSON.stringify(config, null, 2) + "\n");
}

function cmdHooksInstall() {
  const cwd = process.cwd();
  const huskyDir = path.join(cwd, ".husky");
  const gitHooksDir = path.join(cwd, ".git", "hooks");

  const prepareCommitMsg = 'commit-ai prepare-commit-msg "$1" "$2"\n';
  const commitMsg = 'commit-ai lint --edit "$1"\n';

  if (fs.existsSync(huskyDir)) {
    const prepareFile = path.join(huskyDir, "prepare-commit-msg");
    const commitMsgFile = path.join(huskyDir, "commit-msg");

    fs.writeFileSync(prepareFile, prepareCommitMsg, { mode: 0o755 });
    fs.writeFileSync(commitMsgFile, commitMsg, { mode: 0o755 });

    ok("Husky hooks installed:");
    info(`  ${prepareFile}`);
    info(`  ${commitMsgFile}`);
    return;
  }

  if (fs.existsSync(gitHooksDir)) {
    const prepareFile = path.join(gitHooksDir, "prepare-commit-msg");
    const commitMsgFile = path.join(gitHooksDir, "commit-msg");

    const shebang = "#!/bin/sh\n";
    fs.writeFileSync(prepareFile, shebang + prepareCommitMsg, { mode: 0o755 });
    fs.writeFileSync(commitMsgFile, shebang + commitMsg, { mode: 0o755 });

    ok("Git hooks installed:");
    info(`  ${prepareFile}`);
    info(`  ${commitMsgFile}`);
    return;
  }

  fail("No .husky/ directory or .git/hooks/ found. Initialize git or Husky first.");
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help") {
    printHelp();
    process.exit(cmd ? 0 : 1);
  }
  if (cmd === "run") {
    const flags = parseRunArgs(argv.slice(1));
    await cmdRun(flags);
    return;
  }
  if (cmd === "prepare-commit-msg") {
    const file = argv[1];
    const source = argv[2];
    if (!file) {
      throw new Error("Usage: ai-commit prepare-commit-msg <file> [source]");
    }
    await cmdPrepareCommitMsg(file, source);
    return;
  }
  if (cmd === "lint") {
    const { file } = parseLintArgv(argv);
    cmdLint(file);
    return;
  }
  if (cmd === "config") {
    cmdConfig(argv.slice(1));
    return;
  }
  if (cmd === "hooks") {
    if (argv[1] === "install") {
      cmdHooksInstall();
      return;
    }
    throw new Error("Usage: commit-ai hooks install");
  }
  throw new Error(`Unknown command: ${cmd}. Run commit-ai --help for usage.`);
}

main().catch((e) => {
  fail(e.message);
  process.exit(1);
});
