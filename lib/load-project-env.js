"use strict";

const path = require("path");
const dotenv = require("dotenv");

/**
 * Load `.env` then `.env.local` from cwd (`.env.local` overrides duplicate keys).
 * @param {string} [cwd=process.cwd()]
 */
function loadProjectEnv(cwd = process.cwd()) {
  dotenv.config({ path: path.join(cwd, ".env") });
  dotenv.config({ path: path.join(cwd, ".env.local"), override: true });
}

module.exports = { loadProjectEnv };
