import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@libsql/client";

async function main() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const res = await db.execute("SELECT id, content_md FROM reports ORDER BY id DESC LIMIT 1");
  console.log("=== LATEST REPORT ===");
  if (res.rows.length > 0) {
    console.log(res.rows[0].content_md);
  }
}
main();
