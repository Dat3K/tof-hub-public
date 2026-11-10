ALTER TABLE "queue_jobs" ADD COLUMN "payload_bytes" INTEGER;
ALTER TABLE "notification_import_files" ADD COLUMN "payload_bytes" INTEGER;

CREATE TABLE "queue_job_payload_chunks" (
    "job_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL CHECK (octet_length("bytes") BETWEEN 1 AND 1048576),
    PRIMARY KEY ("job_id", "part"),
    CONSTRAINT "queue_job_payload_chunks_job_id_fkey"
        FOREIGN KEY ("job_id") REFERENCES "queue_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notification_import_file_payload_chunks" (
    "file_id" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL CHECK (octet_length("bytes") BETWEEN 1 AND 1048576),
    PRIMARY KEY ("file_id", "part"),
    CONSTRAINT "notification_import_file_payload_chunks_file_id_fkey"
        FOREIGN KEY ("file_id") REFERENCES "notification_import_files"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
