"use strict";

const OpenAI = require("openai");
const { getPromptInstructions } = require("../rules.js");

const DEFAULT_MODEL = "gpt-4o-mini";

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error(
      "OPENAI_API_KEY is not set. Add it to your environment or a .env file in the project root.",
    );
    err.code = "ENOKEY";
    throw err;
  }
  return new OpenAI({ apiKey: key });
}

async function generateCommitMessage(
  stagedDiff,
  scopeHints,
  { model = process.env.COMMIT_AI_MODEL || DEFAULT_MODEL } = {},
) {
  const client = getClient();
  const system = [
    "You are a concise assistant that writes git commit messages.",
    getPromptInstructions(),
  ].join("\n\n");
  const hintBlock =
    scopeHints.length > 0
      ? `\nScope hints (optional, not mandatory):\n${scopeHints.map((h) => `- ${h}`).join("\n")}\n`
      : "";
  const user = [
    "Staged diff:",
    "```",
    stagedDiff.length > 120000
      ? `${stagedDiff.slice(0, 120000)}\n\n[diff truncated for length]`
      : stagedDiff,
    "```",
    hintBlock,
  ].join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned an empty message.");
  }
  return text.replace(/^```[\w]*\n?/i, "").replace(/\n?```$/i, "").trim();
}

module.exports = { generateCommitMessage, getClient, DEFAULT_MODEL };
