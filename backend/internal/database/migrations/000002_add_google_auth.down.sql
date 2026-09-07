DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_google_id;

ALTER TABLE users 
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS avatar_url,
    DROP COLUMN IF EXISTS google_id,
    DROP COLUMN IF EXISTS auth_provider;
