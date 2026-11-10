# Ranking and identity caches

PostgreSQL remains authoritative. Every live Redis lookup checks the durable
ranking revision; imports and rescoring invalidate earlier response keys.
Redis/revision failure falls back to the existing database path.

First pages of 50 and 100 entries are cached for Players and Gear, including
supported gear slots. Keys include role, track, region and limit, plus separate
`verified=1`, global-place and nondefault-sort suffixes. Equivalent visitors
share a result; different result sets cannot reuse each other's key. Search,
slot-name search and later pages keep their existing paths. Successful payloads
are limited to 2 MiB and expire after one hour. Identical pending computations
share a promise in the API process.

Startup performs 14 sequential warmup queries, including the all-track,
all-region Players top-50/top-100 with `verified=1`. The daily forced full run
uses 03:01 UTC. Gear slot variants fill on demand rather than multiplying all
slots by regions and tracks. Disabled or unavailable Redis does no speculative
warmup.

Pioneer retains a separate snapshot policy. Its live comparison reads gear in
pages of 256 ordered by ID within one repeatable read transaction. The scan
keeps slot winners for each applicable scoring combination and region, then
caches the selected builds. Global Best and all regional builds share a scan
per role. Concurrent requests for the same role share the pending result,
while cold scans for different roles run in sequence.

Raid current-name lookup uses separate RoleID and UID namespaces under the
durable ranking revision. Positive responses live for one hour; negative
responses for 30 seconds. Imports, renames and privacy changes make old bindings
unreachable, and hidden profiles are excluded. Historical raid names are not
rewritten. Browser caching has a shorter lifetime and failed refresh batches
preserve previously obtained names.

The `Me` control uses a separate browser convenience identity from a successful
import, never authentication. It reuses a loaded owner row or searches the exact
UID with the active board filters. Turning it off hides the pin while retaining
the result or pending lookup. Re-enabling does not repeat a successful or missing
lookup. Errors allow retry; changed filters, board data version or imported owner
clear the lookup. It stores no ranking result in localStorage and adds no polling.

Tests cover filter isolation, shared responses, TTL, revision invalidation,
RoleID/UID aliases, error fallback, warmup targets and owner-button toggles.
