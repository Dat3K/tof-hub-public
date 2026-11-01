-- Baseline schema for new installations.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "feedback_responses" (
    "id" UUID NOT NULL,
    "survey" TEXT NOT NULL,
    "request_digest" TEXT NOT NULL,
    "visual" INTEGER,
    "data_trust" INTEGER,
    "usability" INTEGER,
    "usefulness" INTEGER,
    "ai_trace" INTEGER,
    "ai_comment" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "release" TEXT,
    "player_uid" TEXT,
    "player_nickname" TEXT,
    "time_zone" TEXT,
    "screen" TEXT,
    "country" TEXT,
    "device" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_notes" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "page" TEXT,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_prompt_claims" (
    "survey" TEXT NOT NULL,
    "network_key" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "claimed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_prompt_claims_pkey" PRIMARY KEY ("survey","network_key")
);

-- CreateTable
CREATE TABLE "game_version_branches" (
    "id" TEXT NOT NULL,
    "version" TEXT,
    "changed_at" TIMESTAMPTZ(3),
    "checked_at" TIMESTAMPTZ(3),
    "attempted_at" TIMESTAMPTZ(3),
    "error" BOOLEAN NOT NULL DEFAULT false,
    "resource_branch" TEXT,
    "source_url" TEXT,
    "launcher_version" TEXT,

    CONSTRAINT "game_version_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_version_events" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "precision" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "resource_branch" TEXT,
    "source_url" TEXT,
    "launcher_version" TEXT,

    CONSTRAINT "game_version_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pioneer_gear" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "piece" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pioneer_gear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pioneer_winners" (
    "key" TEXT NOT NULL,
    "gear_id" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "pioneer_winners_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "wish_profiles" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "region" TEXT NOT NULL DEFAULT 'global',
    "server" TEXT NOT NULL DEFAULT '9999001',
    "player_id" TEXT,
    "pity_snapshots" TEXT,
    "avatar_id" TEXT,
    "avatar_frame_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wish_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wish_banners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "banner_type" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "weapon_id" TEXT,
    "matrix_id" TEXT,
    "pity_target" INTEGER NOT NULL DEFAULT 80,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "cashback_currency" TEXT NOT NULL,
    "featured_ssr" TEXT NOT NULL,
    "standard_pool_items" TEXT NOT NULL DEFAULT '[]',
    "assets" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wish_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wish_records" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "banner_id" TEXT NOT NULL,
    "banner_type" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "rarity" INTEGER NOT NULL,
    "pity_count" INTEGER NOT NULL,
    "is_guaranteed_pity" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "streak_outcome" TEXT,
    "slot" TEXT,
    "pull_timestamp" TIMESTAMP(3) NOT NULL,
    "group_ticks" TEXT,
    "raw_banner_code" TEXT,
    "item_index" INTEGER,
    "track_pull_number" INTEGER,
    "compensation" TEXT,

    CONSTRAINT "wish_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wish_cashback_transactions" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "banner_id" TEXT,
    "currency_type" TEXT NOT NULL,
    "amount_change" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wish_cashback_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "uid" TEXT,
    "role_id" TEXT,
    "nickname" TEXT,
    "search_name" TEXT,
    "server_id" TEXT,
    "region" TEXT,
    "level" INTEGER,
    "crew" TEXT,
    "title_id" TEXT,
    "avatar_id" TEXT,
    "avatar_frame_id" TEXT,
    "combat_score" INTEGER,
    "max_combat_score" INTEGER,
    "max_combat_score_at" TIMESTAMP(3),
    "total_recharge" BIGINT,
    "spent_usd" DECIMAL(12,2),
    "account_stats" JSONB,
    "account_stats_at" TIMESTAMP(3),
    "self_capture_at" TIMESTAMP(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_names" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "search_name" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_name_observations" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_name_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_reports" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "reporter_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "player_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_purchases" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "pack_name" TEXT,
    "price_usd" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchased_at" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "upload_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "player_id" TEXT,
    "kind" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "exporter_name" TEXT NOT NULL,
    "exporter_version" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "ip" TEXT,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_items" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "instance_id" TEXT,
    "fingerprint" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "enhancement" INTEGER NOT NULL,
    "titan" BOOLEAN NOT NULL DEFAULT false,
    "augmented" BOOLEAN NOT NULL DEFAULT false,
    "rare_id" TEXT,
    "rare_level" INTEGER,
    "stats" JSONB NOT NULL,
    "stats_before_titan" JSONB,
    "augments" JSONB NOT NULL DEFAULT '[]',
    "augment_count" INTEGER,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'self',
    "upload_id" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_scores" (
    "gear_item_id" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "region" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "max_score" DOUBLE PRECISION NOT NULL,
    "source_track" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gear_scores_pkey" PRIMARY KEY ("gear_item_id","track")
);

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "upload_id" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "combat_score" INTEGER,
    "element" TEXT,
    "role" TEXT,
    "draft" JSONB NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_gear" (
    "build_id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "gear_item_id" TEXT NOT NULL,

    CONSTRAINT "build_gear_pkey" PRIMARY KEY ("build_id","slot")
);

-- CreateTable
CREATE TABLE "build_profiles" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "name" TEXT,
    "capture" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "art" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mmo_build_profiles" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "capture" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "art" JSONB,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mmo_build_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_revisions" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_pwg_identities" (
    "uid" TEXT NOT NULL,
    "pwg_uid" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "app_id" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "file_hash" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_pwg_identities_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "player_scores" (
    "player_id" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "region" TEXT,
    "build_id" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "max_score" DOUBLE PRECISION NOT NULL,
    "source_track" TEXT,
    "gear_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_scores_pkey" PRIMARY KEY ("player_id","track")
);

-- CreateTable
CREATE TABLE "rank_snapshots" (
    "id" TEXT NOT NULL,
    "board" TEXT NOT NULL,
    "region" TEXT,
    "server_id" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "upload_id" TEXT,

    CONSTRAINT "rank_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rank_entries" (
    "snapshot_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "player_id" TEXT,
    "role_id" TEXT,
    "nickname" TEXT,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "rank_entries_pkey" PRIMARY KEY ("snapshot_id","rank")
);

-- CreateTable
CREATE TABLE "abuse_counters" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abuse_counters_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "queue_jobs" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "ip" TEXT,
    "payload" BYTEA,
    "result" JSONB,
    "delivery" JSONB,
    "delivery_expires_at" TIMESTAMP(3),
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_accounts" (
    "uid" TEXT NOT NULL,
    "role_id" TEXT,
    "nickname" TEXT,
    "distributions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_accounts_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "test_account_servers" (
    "uid" TEXT NOT NULL,
    "distribution" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "first_time_source" TEXT NOT NULL,
    "last_time_source" TEXT NOT NULL,
    "first_evidence" JSONB NOT NULL,
    "last_evidence" JSONB NOT NULL,

    CONSTRAINT "test_account_servers_pkey" PRIMARY KEY ("uid","distribution")
);

-- CreateTable
CREATE TABLE "test_account_imports" (
    "file_hash" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_account_imports_pkey" PRIMARY KEY ("file_hash")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "update_offset" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "event" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_messages" (
    "id" TEXT NOT NULL,
    "message_id" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_import_files" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "parts" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "owner_uid" TEXT,
    "owner_nickname" TEXT,
    "payload" BYTEA,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "message_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_import_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negative_combat_scores" (
    "uid" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "scanned_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3),
    "time_source" TEXT NOT NULL,
    "scan_id" TEXT,
    "distribution" TEXT,
    "source_kind" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,

    CONSTRAINT "negative_combat_scores_pkey" PRIMARY KEY ("uid")
);

-- CreateIndex
CREATE INDEX "feedback_responses_created_id" ON "feedback_responses"("created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "feedback_notes_page_created" ON "feedback_notes"("page", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_notes_response_id_position_key" ON "feedback_notes"("response_id", "position");

-- CreateIndex
CREATE INDEX "game_version_events_branch_time" ON "game_version_events"("branch_id", "observed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pioneer_gear_fingerprint_key" ON "pioneer_gear"("fingerprint");

-- CreateIndex
CREATE INDEX "pioneer_winners_gear_id_idx" ON "pioneer_winners"("gear_id");

-- CreateIndex
CREATE INDEX "wish_profiles_player_id_idx" ON "wish_profiles"("player_id");

-- CreateIndex
CREATE INDEX "wish_records_profile_id_banner_type_pull_timestamp_idx" ON "wish_records"("profile_id", "banner_type", "pull_timestamp");

-- CreateIndex
CREATE INDEX "wish_records_banner_id_idx" ON "wish_records"("banner_id");

-- CreateIndex
CREATE INDEX "wish_cashback_transactions_profile_id_currency_type_idx" ON "wish_cashback_transactions"("profile_id", "currency_type");

-- CreateIndex
CREATE UNIQUE INDEX "players_uid_key" ON "players"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "players_role_id_key" ON "players"("role_id");

-- CreateIndex
CREATE INDEX "players_region_server_id_idx" ON "players"("region", "server_id");

-- CreateIndex
CREATE INDEX "players_nickname_idx" ON "players"("nickname");

-- CreateIndex
CREATE INDEX "player_names_nickname_idx" ON "player_names"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "player_names_player_id_nickname_key" ON "player_names"("player_id", "nickname");

-- CreateIndex
CREATE INDEX "player_name_observations_player_id_observed_at_idx" ON "player_name_observations"("player_id", "observed_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_name_observations_player_id_observed_at_nickname_key" ON "player_name_observations"("player_id", "observed_at", "nickname");

-- CreateIndex
CREATE INDEX "player_reports_player_id_status_idx" ON "player_reports"("player_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "player_purchases_player_id_pack_id_purchased_at_key" ON "player_purchases"("player_id", "pack_id", "purchased_at");

-- CreateIndex
CREATE INDEX "uploads_player_id_created_at_idx" ON "uploads"("player_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_kind_file_sha256_key" ON "uploads"("kind", "file_sha256");

-- CreateIndex
CREATE INDEX "gear_items_player_slot_cover_idx" ON "gear_items"("player_id", "slot", "id");

-- CreateIndex
CREATE INDEX "gear_items_player_id_equipped_idx" ON "gear_items"("player_id", "equipped");

-- CreateIndex
CREATE UNIQUE INDEX "gear_items_player_id_fingerprint_key" ON "gear_items"("player_id", "fingerprint");

-- CreateIndex
CREATE INDEX "gear_scores_track_slot_region_score_idx" ON "gear_scores"("track", "slot", "region", "score" DESC);

-- CreateIndex
CREATE INDEX "gear_scores_track_region_score_idx" ON "gear_scores"("track", "region", "score" DESC);

-- CreateIndex
CREATE INDEX "gear_scores_slot_board_cover_idx" ON "gear_scores"("track", "slot", "score" DESC, "max_score" DESC, "gear_item_id", "region");

-- CreateIndex
CREATE INDEX "gear_scores_board_cover_idx" ON "gear_scores"("track", "score" DESC, "max_score" DESC, "gear_item_id", "slot", "region");

-- CreateIndex
CREATE INDEX "gear_scores_track_gear_item_id_idx" ON "gear_scores"("track", "gear_item_id");

-- CreateIndex
CREATE INDEX "builds_player_id_captured_at_idx" ON "builds"("player_id", "captured_at");

-- CreateIndex
CREATE INDEX "builds_is_current_element_idx" ON "builds"("is_current", "element");

-- CreateIndex
CREATE INDEX "build_gear_gear_item_id_idx" ON "build_gear"("gear_item_id");

-- CreateIndex
CREATE INDEX "build_profiles_uid_idx" ON "build_profiles"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "build_profiles_uid_role_element_key" ON "build_profiles"("uid", "role", "element");

-- CreateIndex
CREATE INDEX "mmo_build_profiles_uid_idx" ON "mmo_build_profiles"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "mmo_build_profiles_uid_role_key" ON "mmo_build_profiles"("uid", "role");

-- CreateIndex
CREATE INDEX "player_pwg_identities_pwg_uid_app_id_idx" ON "player_pwg_identities"("pwg_uid", "app_id");

-- CreateIndex
CREATE INDEX "player_scores_track_region_score_idx" ON "player_scores"("track", "region", "score" DESC);

-- CreateIndex
CREATE INDEX "player_scores_track_score_idx" ON "player_scores"("track", "score" DESC);

-- CreateIndex
CREATE INDEX "rank_snapshots_board_region_captured_at_idx" ON "rank_snapshots"("board", "region", "captured_at");

-- CreateIndex
CREATE INDEX "rank_entries_player_id_idx" ON "rank_entries"("player_id");

-- CreateIndex
CREATE INDEX "abuse_counters_expires_at_idx" ON "abuse_counters"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "queue_jobs_seq_key" ON "queue_jobs"("seq");

-- CreateIndex
CREATE INDEX "queue_jobs_state_seq_idx" ON "queue_jobs"("state", "seq");

-- CreateIndex
CREATE INDEX "queue_jobs_ip_hash_state_idx" ON "queue_jobs"("ip_hash", "state");

-- CreateIndex
CREATE INDEX "queue_jobs_ip_hash_seq_idx" ON "queue_jobs"("ip_hash", "seq" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_events_seq_key" ON "notification_events"("seq");

-- CreateIndex
CREATE INDEX "notification_events_pending" ON "notification_events"("delivered_at", "next_attempt_at", "created_at");

-- CreateIndex
CREATE INDEX "notification_import_files_pending" ON "notification_import_files"("delivered_at", "next_attempt_at", "created_at");

-- AddForeignKey
ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "feedback_responses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "game_version_events" ADD CONSTRAINT "game_version_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "game_version_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pioneer_winners" ADD CONSTRAINT "pioneer_winners_gear_id_fkey" FOREIGN KEY ("gear_id") REFERENCES "pioneer_gear"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wish_profiles" ADD CONSTRAINT "wish_profiles_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_records" ADD CONSTRAINT "wish_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "wish_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_records" ADD CONSTRAINT "wish_records_banner_id_fkey" FOREIGN KEY ("banner_id") REFERENCES "wish_banners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_cashback_transactions" ADD CONSTRAINT "wish_cashback_transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "wish_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_names" ADD CONSTRAINT "player_names_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_name_observations" ADD CONSTRAINT "player_name_observations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_purchases" ADD CONSTRAINT "player_purchases_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_purchases" ADD CONSTRAINT "player_purchases_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_scores" ADD CONSTRAINT "gear_scores_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "gear_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_gear" ADD CONSTRAINT "build_gear_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_gear" ADD CONSTRAINT "build_gear_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "gear_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_scores" ADD CONSTRAINT "player_scores_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_entries" ADD CONSTRAINT "rank_entries_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "rank_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_entries" ADD CONSTRAINT "rank_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Constraints that the Prisma schema cannot express
ALTER TABLE "test_accounts" ALTER COLUMN "distributions" SET NOT NULL;

ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_response_id_position_key" UNIQUE USING INDEX "feedback_notes_response_id_position_key";
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_seq_key" UNIQUE USING INDEX "notification_events_seq_key";
ALTER TABLE "pioneer_gear" ADD CONSTRAINT "pioneer_gear_fingerprint_key" UNIQUE USING INDEX "pioneer_gear_fingerprint_key";

ALTER TABLE "feedback_notes" ADD CONSTRAINT "feedback_notes_message_check" CHECK (length("message") BETWEEN 1 AND 3000);

ALTER TABLE "feedback_responses"
  ADD CONSTRAINT "feedback_responses_visual_check" CHECK ("visual" BETWEEN 0 AND 10),
  ADD CONSTRAINT "feedback_responses_data_trust_check" CHECK ("data_trust" BETWEEN 0 AND 10),
  ADD CONSTRAINT "feedback_responses_usability_check" CHECK ("usability" BETWEEN 0 AND 10),
  ADD CONSTRAINT "feedback_responses_usefulness_check" CHECK ("usefulness" BETWEEN 0 AND 10),
  ADD CONSTRAINT "feedback_responses_ai_trace_check" CHECK ("ai_trace" BETWEEN 0 AND 10),
  ADD CONSTRAINT "feedback_responses_ai_comment_check" CHECK (length("ai_comment") <= 1000),
  ADD CONSTRAINT "feedback_responses_player_uid_check" CHECK ("player_uid" ~ '^[0-9]{6,24}$'),
  ADD CONSTRAINT "feedback_responses_player_nickname_check" CHECK (length("player_nickname") <= 64),
  ADD CONSTRAINT "feedback_responses_time_zone_check" CHECK (length("time_zone") <= 64),
  ADD CONSTRAINT "feedback_responses_screen_check" CHECK (length("screen") <= 11),
  ADD CONSTRAINT "feedback_responses_country_check" CHECK ("country" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "feedback_responses_device_check" CHECK ("device" IN ('desktop', 'mobile', 'tablet', 'unknown')),
  ADD CONSTRAINT "feedback_responses_os_check" CHECK (length("os") <= 32),
  ADD CONSTRAINT "feedback_responses_browser_check" CHECK (length("browser") <= 32);

ALTER TABLE "negative_combat_scores"
  ADD CONSTRAINT "negative_combat_scores_score_check" CHECK ("score" < 0 AND "score" >= -1e12),
  ADD CONSTRAINT "negative_combat_scores_time_source_check" CHECK ("time_source" IN ('scan', 'observation', 'unknown'));

ALTER TABLE "test_account_servers" ADD CONSTRAINT "test_account_servers_check" CHECK ("first_seen_at" <= "last_seen_at");

-- Small frequent imports must not wait for the default 20% of these JSON-heavy tables to change.
ALTER TABLE "gear_items" SET (autovacuum_vacuum_scale_factor=0.02,autovacuum_vacuum_threshold=500,autovacuum_analyze_scale_factor=0.02);
ALTER TABLE "gear_scores" SET (autovacuum_vacuum_scale_factor=0.02,autovacuum_vacuum_threshold=1000,autovacuum_analyze_scale_factor=0.02);

-- Character UIDs are stored in canonical form: the character-number word after the server ID has no zero padding.
CREATE FUNCTION canonical_character_uid(value text, server text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN value ~ '^[0-9]+$' AND server ~ '^[1-9][0-9]{3,6}$'
    AND left(value, length(server)) = server
    AND substring(value FROM length(server) + 1) ~ '^0+[1-9][0-9]*$'
  THEN server || ltrim(substring(value FROM length(server) + 1), '0') ELSE value END
$$;

-- Defense in depth: rows are normalized on write even if a caller skipped API normalization.
CREATE FUNCTION normalize_stored_character_uid() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE data jsonb; server text; role text; high text;
BEGIN
  data := to_jsonb(NEW);
  IF TG_TABLE_NAME='wish_profiles' AND (data->>'is_demo')::boolean THEN RETURN NEW; END IF;
  server := coalesce(data->>'server_id',data->>'server');
  role := data->>'role_id';
  IF TG_TABLE_NAME IN ('build_profiles','mmo_build_profiles') THEN
    role := (data->>'capture')::jsonb #>> '{capture,subject,roleId}';
  END IF;
  IF role ~ '^[1-9][0-9]{0,23}$' THEN
    high := floor(role::numeric / 4294967296)::text;
    IF left(NEW.uid,length(high))=high THEN server := high; END IF;
  END IF;
  IF server IS NULL THEN
    SELECT p.server_id INTO server FROM players p
    WHERE p.server_id IS NOT NULL AND left(NEW.uid,length(p.server_id))=p.server_id
      AND length(NEW.uid)>length(p.server_id) ORDER BY length(p.server_id) DESC LIMIT 1;
  END IF;
  NEW.uid := canonical_character_uid(NEW.uid,server);
  RETURN NEW;
END $$;

CREATE TRIGGER players_canonical_uid BEFORE INSERT OR UPDATE OF uid,server_id,role_id ON players
  FOR EACH ROW EXECUTE FUNCTION normalize_stored_character_uid();
CREATE TRIGGER wish_profiles_canonical_uid BEFORE INSERT OR UPDATE OF uid,server ON wish_profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_stored_character_uid();
CREATE TRIGGER build_profiles_canonical_uid BEFORE INSERT OR UPDATE OF uid ON build_profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_stored_character_uid();
CREATE TRIGGER mmo_build_profiles_canonical_uid BEFORE INSERT OR UPDATE OF uid ON mmo_build_profiles
  FOR EACH ROW EXECUTE FUNCTION normalize_stored_character_uid();
CREATE TRIGGER test_accounts_canonical_uid BEFORE INSERT OR UPDATE OF uid,role_id ON test_accounts
  FOR EACH ROW EXECUTE FUNCTION normalize_stored_character_uid();
CREATE TRIGGER player_pwg_identities_canonical_uid BEFORE INSERT OR UPDATE OF uid,server_id,role_id ON player_pwg_identities
  FOR EACH ROW EXECUTE FUNCTION normalize_stored_character_uid();
