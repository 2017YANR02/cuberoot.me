/** Shared address only; business and diagnostic pools keep separate limits. */
export function databaseSettings() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'recon_user',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cuberoot_db',
  };
}
