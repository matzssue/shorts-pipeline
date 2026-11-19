import { existsSync } from "node:fs";
import { ENV_FILE } from "./paths.js";

/**
 * Loads `.env` from the content directory into process.env.
 * A missing file is not an error (steps that need keys check for them).
 * Never logs variable values.
 */
export function loadEnv(): { loaded: boolean } {
  if (!existsSync(ENV_FILE)) return { loaded: false };
  process.loadEnvFile(ENV_FILE);
  return { loaded: true };
}

/** Returns a required variable or throws an error with its name (never its value). */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env (see .env.example).`);
  }
  return value;
}
