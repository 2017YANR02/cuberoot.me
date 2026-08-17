const DEVELOPMENT_ADMIN_PASSWORD = "admin123";
const DEVELOPMENT_SESSION_SECRET = "dev-cube-secret-change-me";

function readRequiredProductionEnv(name: string, developmentFallback: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is required in production`);
  }
  return developmentFallback;
}

export function getAdminPassword(): string {
  return readRequiredProductionEnv("ADMIN_PASSWORD", DEVELOPMENT_ADMIN_PASSWORD);
}

export function getSessionSecret(): string {
  return readRequiredProductionEnv("SESSION_SECRET", DEVELOPMENT_SESSION_SECRET);
}
