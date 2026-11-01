#!/bin/sh
set -eu
exec psql -h postgres -U tof_owner -d tof_hub \
  -v runtime_role=tof_runtime -v runtime_password="$RUNTIME_DB_PASSWORD" \
  -v database_name=tof_hub -v migration_role=tof_owner -f /setup/runtime-role.sql
