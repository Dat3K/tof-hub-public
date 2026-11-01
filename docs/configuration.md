# Configuration

All settings live in `.env` in the project root. Create it with:

```bash
docker compose --profile tools run --rm setup
```

`setup` (`scripts/setup.mjs`) fills in random passwords and secrets and never overwrites an existing `.env`. The file is ignored by Git. [`.env.example`](../.env.example) lists every variable with empty secrets; do not use it directly as `.env`.

## Variables

### Site

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `tof-hub-public` | Prefix for container and volume names. Keep it stable, or Compose will create a new empty database. |
| `SITE_URL` | `http://localhost:8080` | Public origin used by the server |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:8080` | Public origin baked into the web build. Rebuild `web` after changing it. |
| `WEB_PORT` | `8080` | Host port Nginx listens on (loopback only) |

Interface languages are defined in code (`packages/i18n/src/constants.ts`), not in `.env`.

### Database

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PASSWORD` | Password of the schema owner `tof_owner` |
| `RUNTIME_DB_PASSWORD` | Password of the CRUD-only API login `tof_runtime` |
| `DATABASE_URL` | Connection string used by the API (`tof_runtime`) |
| `DATABASE_MIGRATION_URL` | Connection string used only by migrations (`tof_owner`) |

The database name `tof_hub` and both role names are fixed in `compose.yml` and `deploy/provision.sh`. If you rename them, update both files and both URLs together.

### Secrets

| Variable | Purpose |
| --- | --- |
| `IP_HASH_SALT` | Salt for pseudonymous per-IP counters. At least 32 characters; keep it stable. |
| `COOKIE_SECRET` | Application cookie secret |
| `FEEDBACK_ADMIN_KEY` | Key for the owner-only feedback administration endpoints |
| `WISH_IMPORT_KEY_ID` | Public identifier of this installation's import key |

### Pipeline

| Variable | Purpose |
| --- | --- |
| `RAW_GAME_DIR` | Host path of an existing raw export (the folder that contains `Hotta/Content`). Mounted read-only at `/raw` in the `tooling` container. |
| `TOF_BOOTSTRAP_URL` | Optional HTTPS URL of the bootstrap package, instead of a manual download |

For pipeline runs outside Docker, `TOF_RAW_GAME_DIR` and `TOF_PUBLIC_DIR` set the raw input and the generated output directory.

### Optional integrations

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CAPTURE_APP_URL` | Link to an external data collector. Leave empty to offer JSON import only. |
| `TELEGRAM_MODE` | `off` (default), `producer`, `relay` or `controller` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID` | Required by `controller` mode |
| `TELEGRAM_RELAY_URL`, `TELEGRAM_RELAY_SECRET` | Required by `relay` mode: an HTTPS URL and a shared secret of at least 32 characters |

Telegram settings are passed only to the `api` container. An invalid combination stops the API at startup.

> [!IMPORTANT]
> Anything prefixed with `NEXT_PUBLIC_` ends up in browser JavaScript. Never put a secret there.

## Container paths

| Container | Path | Contents |
| --- | --- | --- |
| `api` | `/srv/public/game-data` | Generated game data (read-only) |
| `api` | `/app/.data` | Installation import key (`api-private-data` volume) |
| `web` | `/app/apps/web/public` | Generated game data and images (read-only) |
| `nginx` | `/srv/public` | Same files, served directly |

## Installation key

On first start, the `init-key` task creates a 3072-bit RSA private key in the `api-private-data` volume. The API publishes only the matching public key. Rebuilding images does not replace it.

The key does two jobs:

- it decrypts files that were encrypted for this installation;
- it signs accepted build cards, so saved cards can be verified later.

Back it up together with the database. A new key cannot read files addressed to the old one, and saved cards depend on the key that signed them. Deleting the volume is not a way to rotate the key.
