# Operations

The web container build config excludes `public/` for every server route. Compose
mounts the generated content separately at `apps/web/public`; content updates do
not require duplicating the media library inside the web image. A custom
standalone deployment must supply both this public directory and `.next/static`.

Run every command from the project root. The default stack serves `http://localhost:8080`.

## Persistent state

| Location | Contents |
| --- | --- |
| `postgres-data` volume | Users, imports, saved builds, queue state |
| `api-private-data` volume | Installation import and signing key |
| `apps/web/public` | Generated game data and images, mounted read-only |
| `.env` | Credentials and site settings |
| `backups/` | Your local backup copies (ignored by Git) |

Containers and volumes are not backups. Keep copies off the machine or in encrypted storage.

## Backup

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U tof_owner -d tof_hub -Fc -f /tmp/tof-hub.dump
docker compose cp postgres:/tmp/tof-hub.dump backups/tof-hub.dump
docker compose cp api:/app/.data/import-private.pem backups/import-private.pem
```

The dump is written inside the container first, which avoids PowerShell corrupting binary output on redirection. Also keep a copy of `.env`.

## Restore

Restoring replaces the database contents. Make sure you target the right installation.

```bash
docker compose stop api web nginx
docker compose cp backups/tof-hub.dump postgres:/tmp/tof-hub-restore.dump
docker compose exec -T postgres pg_restore -U tof_owner -d tof_hub --clean --if-exists --no-owner /tmp/tof-hub-restore.dump
docker compose run --rm provision
```

Put the matching key back into the API volume before starting the API, because saved cards were signed with it:

```bash
docker compose cp backups/import-private.pem api:/app/.data/import-private.pem
docker compose up -d --wait
```

Afterwards, open a known profile, run a test import and check the queue page.

## Updating the code

1. Back up the database, key and `.env`.
2. Read the release notes.
3. Pull the new version. If `config/bootstrap.json` changed, restore the new bootstrap package.
4. Rebuild and start:

   ```bash
   docker compose up -d --build --wait
   ```

5. Check that `migrate` and `provision` exited with code 0 and that all services are healthy.

## Updating game data

Generate and validate the new content separately (see the [pipeline guide](pipeline.md)), then install it with the exporter's update command, which also removes deleted files:

```bash
pnpm --filter @tof-hub/tof-exporter apply-update -- <UPDATE_DIRECTORY_OR_ZIP>
```

Then restart the services that cache catalogs:

```bash
docker compose restart api web
```

Rebuild `web` as well when a manifest imported at build time has changed. Keep the previous release and its manifest so you can roll back.

Replacing files one by one is not atomic. For a busy site, prepare the complete new directory first and switch to it during a short controlled restart.

## Logs and health

```bash
docker compose ps -a
docker compose logs --tail=200 api
docker compose logs --tail=200 web
docker compose logs --tail=200 migrate provision init-key
curl http://localhost:8080/api/v1/health
```

`migrate`, `provision` and `init-key` are one-shot tasks; `Exited (0)` is the expected state.

## Public domain and HTTPS

1. Terminate HTTPS at a reverse proxy you control and forward to the local Nginx port.
2. Set `SITE_URL` and `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin.
3. Rebuild: `docker compose up -d --build --wait`.

The API trusts exactly one proxy hop (`WISH_TRUST_PROXY_HOPS=1`): the bundled Nginx sets the client address header. If you add another proxy layer, review this setting and the forwarded-header policy together. Never publish PostgreSQL, Redis or API ports to make something work.

## Notifications

Telegram notification code is included but off by default. If you enable it, run it as a dedicated worker from the API image with its own bot credentials, so the main API never holds the bot token. JSON import works without any external service.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `Cannot connect to the Docker daemon` / missing named pipe | Start Docker Desktop or the Docker Engine, then run `docker version` and confirm a `Server` section appears. |
| Bootstrap: missing input or `SHA-256 mismatch` | The archive must be exactly the version pinned in `config/bootstrap.json`. |
| `Missing site input` during generation | Run the bootstrap step before generating data or packaging the exporter. |
| `/raw/Hotta` not found | `RAW_GAME_DIR` must point at the folder that contains `Hotta`, not its parent. |
| Info or Build pages are empty | Generated data is not installed in `apps/web/public`. |
| API complains about `DATABASE_URL` or `IP_HASH_SALT` | Run `setup` and check `.env`. An empty `.env.example` copied as `.env` will not work. |
| `migrate` or `provision` failed | `docker compose logs migrate provision`. Do not delete the volume to "fix" it. |
| `Port is already allocated` | Change `WEB_PORT`, update both site URLs and rebuild `web`. |
| Encrypted file rejected for another key | The file was encrypted for a different installation. Import it as JSON instead. |

When reporting a problem, include the failing command, the service name, the sanitized error and the release version. Never attach `.env`, keys, access tokens or user import files to a public issue.

> [!WARNING]
> `docker compose down -v` deletes the database and the import key. Use `docker compose stop` for a normal shutdown.
