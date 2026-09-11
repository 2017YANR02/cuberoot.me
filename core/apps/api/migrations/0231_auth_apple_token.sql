-- Keep Apple's revocation credential with its existing identity; never expose it in identity lists.
ALTER TABLE auth_identities
  ADD COLUMN apple_refresh_token_encrypted BYTEA,
  ADD COLUMN apple_token_key_version SMALLINT,
  ADD CONSTRAINT auth_identity_apple_token CHECK (
    (apple_refresh_token_encrypted IS NULL AND apple_token_key_version IS NULL)
    OR (provider = 'apple' AND apple_refresh_token_encrypted IS NOT NULL
        AND octet_length(apple_refresh_token_encrypted) > 28
        AND apple_token_key_version IS NOT NULL AND apple_token_key_version = 1)
  );
