-- DB and user are created by postgres image via
-- POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD environment variables.
-- Keep only idempotent initialization logic here.
-- Some Postgres builds may not provide uuid-ossp; do not fail init in that case.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION
    WHEN undefined_file THEN
        RAISE NOTICE 'Extension uuid-ossp is not available in this image. Skipping.';
END
$$;
