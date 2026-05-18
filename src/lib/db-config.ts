import path from "path";

/** Turso remote or local file DB for design preview / dev. */
export function resolveDatabaseUrl(): string {
  const configured = process.env.TURSO_DATABASE_URL?.trim();
  if (configured) return configured;

  const localFile = `file:${path.join(process.cwd(), "local.db")}`;

  // next dev / preview: always allow local.db (ignore VERCEL=* in .env.local)
  if (process.env.NODE_ENV === "development") {
    return localFile;
  }

  if (process.env.VERCEL === "1") {
    throw new Error(
      "TURSO_DATABASE_URL is required on Vercel. For local UI preview run `npm run db:dev:setup`."
    );
  }

  return localFile;
}

export function resolveAuthToken(): string | undefined {
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  return token || undefined;
}
