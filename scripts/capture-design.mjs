#!/usr/bin/env node
/**
 * Capture all main routes for design verification.
 * Requires: npm run dev:preview (or dev) + npm run db:dev:setup
 *
 * Usage: npm run design:capture
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "screenshots", "verify");
const BASE = process.env.DESIGN_CAPTURE_URL || "http://localhost:3000";

const ROUTES = [
  { name: "dashboard", path: "/" },
  { name: "stocks", path: "/stocks" },
  { name: "stock-detail", path: "/stocks/005380" },
  { name: "disclosures", path: "/disclosures" },
  { name: "signals", path: "/signals" },
  { name: "journal", path: "/journal" },
  { name: "reports", path: "/reports" },
  { name: "report-detail", path: "/reports/1" },
  { name: "discover", path: "/discover" },
  { name: "settings", path: "/settings" },
  { name: "login", path: "/login", skipAuth: true },
];

async function loginIfNeeded(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const previewBtn = page.getByRole("button", { name: /디자인 프리뷰/i });
  if (await previewBtn.isVisible().catch(() => false)) {
    await previewBtn.click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  } else {
    console.warn("⚠️  디자인 프리뷰 버튼 없음 — .env.local에 DEV_PREVIEW_AUTH=true 확인");
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await loginIfNeeded(page);

  for (const route of ROUTES) {
    if (route.skipAuth) {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      const url = `${BASE}${route.path}`;
      console.log(`📷 ${route.name} → ${url}`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    }
    await page.waitForTimeout(600);
    const file = path.join(OUT, `${route.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`   saved ${file}`);
  }

  await browser.close();
  console.log(`\n✅ ${ROUTES.length} screenshots in screenshots/verify/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
