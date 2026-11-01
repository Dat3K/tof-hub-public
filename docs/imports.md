# Imports

User data (build cards, wish histories, player rankings) enters an installation through import files. Every installation has its own database, import key and signing key; nothing is shared with the official site.

Two separate things are often confused:

| | Game-data pipeline | User imports |
| --- | --- | --- |
| Input | Installed game client | JSON files from players |
| Output | Static catalogs and images | Rows in this installation's database |
| Docs | [Pipeline](pipeline.md) | This page |

Static game files contain no player histories, so the pipeline can never produce user data.

## File types

The API accepts plain JSON and installation-encrypted files at the same endpoints.

- **JSON** is parsed and normalized into the same processing path as encrypted files. All schemas, limits and persistence rules apply.
- **Encrypted files** (`.tofbuild`, `.tofwish`, `.tofplayers`) contain an AES-256-GCM ciphertext whose random key is wrapped with this installation's RSA-OAEP public key. Only this installation can read them.

Encryption protects the file in transit. It does not authenticate the sender or prove the numbers came from the game. Treat every import as user-provided data.

## Formats

All examples live in [`examples/import`](../examples/import). They use synthetic identities and are validated against the shared schemas:

```bash
pnpm validate:import-examples
```

| Example | Used by | Endpoint | Schema |
| --- | --- | --- | --- |
| `build.json` | Build card, Gear optimizer | `POST /api/v1/build/import` | `BuildCaptureSchema` |
| `build-mmo.json` | MMO build card | same endpoint | `BuildCaptureSchema` |
| `wish.json` | Wish tracker | `POST /api/v1/wish/import/jobs` | `WishImportV2PayloadSchema` |
| `players.json` | Ranking | `POST /api/v1/ranking/inspect` | `PlayerImportBundleSchema` |
| `raid-rankings.json` | Raid comparison (pipeline input) | `TOF_RAID_RANKINGS_FILE` | `RaidRankingDatasetSchema` |
| `comp.json` | Comp showcase | `?c=` URL parameter | Comp codec |

A file that passes the schema can still be refused, for example for an unknown item identity, inconsistent data, a missing catalog or a database rule.

### Build

The root declares `"format": "tof-hub-build-capture"` and `schemaVersion` 2 or 3.

| Section | Contents |
| --- | --- |
| `capture` | Who was captured, when, and by which tool |
| `profile` | Character metadata |
| `combat` | Reported combat values |
| `weapons`, `matrices`, `gear`, `relics`, `pet` | Equipped items |
| `computing`, `support`, `synthesis`, `buffs`, `weaponSettings` | Supporting systems |
| `inventory` | Optional backpack gear, used by the optimizer |
| `mmo` | Optional MMO-specific fields |

Use `null` for unknown values. Schema version 3 requires scan provenance; never invent it or mark hand-entered data as verified.

The optimizer reads equipped and backpack gear from the same build file. There is no separate gear format.

Raw `gear[].stats[].value`, `inventory[].stats[].value` and their `beforeTitan`
values accept any finite JavaScript number, including negative values. There is
no verified universal magnitude limit for raw attributes; the importer preserves
the received values without clamping. Attribute mapping still determines what
contributes to a build or ranking. Accepted numeric syntax does not establish an
unknown attribute's game meaning. File sizes, array limits, structure and finite
number checks still apply.

### Wish

A v2 document contains `export_metadata`, `account`, `batches` and optional `pity_snapshots`.

Each batch keeps its source banner code, track, `group_ticks`, timestamp and each pull's `index_in_batch`. These fields drive deduplication, so uploading the same history twice does not double-count pulls.

Banners and items are resolved against the generated catalogs. Unknown attribution stays unresolved; a banner is never guessed from the dropped item alone.

**Access control.** The first accepted import returns a device token. Keep it private: it is what authorizes later updates to that profile. Knowing a UID is not enough. For scripted updates, send owned tokens in `x-wish-import-tokens`; reads use `x-wish-token`. The browser stores its tokens locally.

### Players

A v1 bundle contains producer metadata, the observer's identity, `players` and an optional `owner` snapshot. Contracts are exported from `packages/contracts/src/player-import.ts`.

Identity, source policy and equipment mapping are checked before anything is stored. Unknown slots and items are not converted into guessed equipment. Ranking scores are computed on the server.

### Raid rankings

This is a pipeline input, not an upload endpoint. Set `TOF_RAID_RANKINGS_FILE` to a normalized JSON file before generating the Handbook; without it, the raid comparison is empty.

The example uses synthetic labels, an unknown duration and the SHA-256 of empty bytes as its source hash, because no game evidence is attached. Replace that hash with the hash of your real evidence. Board references must resolve and IDs must be unique. Durations keep their original representation alongside interpreted milliseconds; an approximate reading must stay approximate.

### Comp

The compact share format:

| Field | Meaning |
| --- | --- |
| `m` | Player count, 4 or 8 |
| `s` | `standard` or `mmo` |
| `t` | Title |
| `p` | Players: `n` (name), `w` (weapons), `rl` (relics), optional roles and settings |

URL-encode the JSON into `/tools/comp/?c=...`. The compressed share-link formats used by the site are also accepted. Payloads are limited to 64 KiB.

## Queue protocol

A successful `POST` returns a job (`id`, `state`), not the result. Poll it from the same network address:

```http
GET /api/v1/queue/jobs/<id>
```

| State | Action |
| --- | --- |
| `queued`, `running` | Keep polling |
| `failed` | Read the structured error |
| `complete` | Use `result`, or fetch `/api/v1/queue/jobs/<id>/delivery` once when `deliveryAvailable` is true |

The delivery is returned only once and may contain private data. Never post it publicly. See [job queue](architecture/job-queue.md) for limits and retention.

## Command-line import

`scripts/import-json.mjs` implements the protocol above:

```bash
node scripts/import-json.mjs --kind build   --file examples/import/build.json
node scripts/import-json.mjs --kind wish    --file examples/import/wish.json
node scripts/import-json.mjs --kind players --file examples/import/players.json
```

Without Node on the host, run it in the bootstrap container against Nginx:

```bash
docker compose --profile tools run --rm bootstrap node scripts/import-json.mjs --kind build --file examples/import/build.json --origin http://nginx
```

Results, including access tokens, are written to `ignore/import-results/` with restrictive permissions instead of being printed.

### Saving an accepted build

A successful build import also writes `ignore/import-results/build-profile.json`: the exact card plus this installation's signature, ready to save as a public profile.

```bash
node scripts/import-json.mjs --kind profile --file ignore/import-results/build-profile.json
```

Choose the role and element before submitting. Editing the card invalidates the signature, and signatures from another installation are rejected.

For MMO builds, keep the result in its own directory. The CLI sets `mode: mmo` and omits the Global-only `element` field:

```bash
node scripts/import-json.mjs --kind build --file examples/import/build-mmo.json --out ignore/import-results/mmo/build.json
node scripts/import-json.mjs --kind mmo-profile --file ignore/import-results/mmo/build-profile.json
```

## Limits and errors

Size limits are declared in `packages/contracts/src/sealed-files.ts`. Encryption and base64 add overhead, so a plain file close to the limit may exceed it once encrypted.

Use finite numbers, keep `null` for unknown values, use canonical identifiers and timestamps, and send each file to its own endpoint. ZIP archives, images, malformed JSON, unsafe object keys and unsupported schema versions are rejected.
