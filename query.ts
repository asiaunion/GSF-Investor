import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.run(sql`SELECT id, content_md FROM reports WHERE id=3;`);
  console.log(result.rows);
}
main();
