import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

// .env.local 수동 파싱
const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

try {
  await client.execute(
    "ALTER TABLE trade_journal ADD COLUMN confidence_score INTEGER"
  );
  console.log("✅ confidence_score 컬럼 추가 완료");
} catch (err) {
  if (err.message?.includes("duplicate column")) {
    console.log("ℹ️  이미 존재하는 컬럼 — 스킵");
  } else {
    console.error("❌ 마이그레이션 실패:", err.message);
    process.exit(1);
  }
}
