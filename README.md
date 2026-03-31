# @verndale/commit-ai

AI-assisted [Conventional Commits](https://www.conventionalcommits.org/) with **bundled [commitlint](https://commitlint.js.org/)** so generated messages match the same rules enforced in hooks.

## Requirements

- **Node.js** `>=24.14.0`
- This repo uses **pnpm** (`packageManager` is pinned in `package.json`; enable via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

## Install

```bash
pnpm add -D @verndale/commit-ai
```

## Environment

- **`OPENAI_API_KEY`** — Required for `commit-ai run` (and for AI-filled `prepare-commit-msg` when you want the model). Optional `COMMIT_AI_MODEL` (default `gpt-4o-mini`).
- The CLI loads **`.env`** from the current working directory (project root).

## Commands

| Command | Purpose |
| --- | --- |
| `commit-ai run` | Generate a message from the staged diff and run `git commit`. |
| `commit-ai prepare-commit-msg <file> [source]` | Git `prepare-commit-msg` hook: fill an empty message; skips `merge` / `squash`. |
| `commit-ai lint --edit <file>` | Git `commit-msg` hook: run commitlint with this package’s default config. |

## package.json scripts (example)

```json
{
  "scripts": {
    "commit": "commit-ai run"
  }
}
```

## Husky (manual setup)

Install Husky in your project (`husky` + `"prepare": "husky"` in `package.json` if needed), then add hooks.

**`.husky/prepare-commit-msg`**

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec commit-ai prepare-commit-msg "$1" "$2"
```

**`.husky/commit-msg`**

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec commit-ai lint --edit "$1"
```

Use `npx` or `yarn` instead if that matches your toolchain.

## commitlint without a second install

Use the packaged binary from hooks (`commit-ai lint --edit`) as above.

To **extend** the default rules in your own `commitlint.config.js`, you can start from the same preset:

```js
module.exports = {
  extends: ["@verndale/commit-ai"],
  rules: {
    // optional overrides
  },
};
```

Programmatic access to shared constants (types, line limits) is available via:

```js
const rules = require("@verndale/commit-ai/rules");
```

## Development (this repository)

```bash
corepack enable
pnpm install
```

## Publishing (maintainers)

1. Bump version: `pnpm version patch|minor|major` (creates a git tag).
2. `pnpm publish` — CI can publish on tag when `NPM_TOKEN` is configured (see `.github/workflows/publish.yml`).

## License

MIT — see [LICENSE](./LICENSE).
