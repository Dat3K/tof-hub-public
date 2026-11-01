# Contributing

Thanks for helping with ToF Hub. Bug reports, data corrections, translations and code changes are all welcome.

## Before you start

- **Bugs and wrong data:** open an issue with the page URL, what you expected and what you saw. For game data, say which edition (Global or MMO), region and game version.
- **Larger changes:** open an issue first so we can agree on the approach before you spend time on it.

## Setting up

The [README](README.md#getting-started) covers the full export and the Docker stack. For working on the code, see [development](docs/development.md): Node.js 24, pnpm 12.5.1 and Docker for PostgreSQL and Redis.

Much of the site reads generated game data. Without it, the web typecheck and several regression tests fail. Restore the bootstrap package and generate the data for the part you are changing, as described in the [pipeline guide](docs/pipeline.md).

## Making a change

1. Fork the repository and create a branch from `main`.
2. Keep each pull request to one topic.
3. Run the checks from [development](docs/development.md#checks) for the parts you touched, plus `node scripts/check-public-source.mjs`.
4. Open a pull request and describe what changed, why, and how you checked it. Add screenshots for UI changes.

## Rules for this repository

- **No generated data or game files.** Game JSON, images, raw exports and executables never go into Git. Change the processor or generator instead; see [data provenance](docs/data-provenance.md).
- **Editorial media exception:** the reviewed screenshots in `docs/screenshots/` and chat stickers in `docs/stickers/` illustrate the case study. This does not permit exporting game catalogs or adding arbitrary media.
- **No guessed values.** If something cannot be derived from the game files, keep it as an explicit, documented input.
- **UI copy:** write the English text in code and add the Russian one beside it. Translations for the other languages live in `packages/i18n`.
- **Lockfile:** install with `pnpm install --frozen-lockfile`; change dependencies only on purpose and commit the updated `pnpm-lock.yaml`.
- **Secrets:** never commit `.env`, keys or tokens. CI runs a secret scan on every pull request.

## License

By contributing, you agree that your contribution is released under the [MIT License](LICENSE).
