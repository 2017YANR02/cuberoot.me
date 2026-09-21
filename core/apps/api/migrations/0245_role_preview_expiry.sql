-- Retire legacy unlimited role-test sessions when the finite session policy ships.
UPDATE role_preview_sessions
SET expires_at = created_at + INTERVAL '30 minutes'
WHERE expires_at = 'infinity'::timestamptz;
