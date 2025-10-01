// node frontend/scripts/report-hardwraps.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../src");
const exts = new Set([".tsx", ".ts"]);

const suspicious = [
  /onClic\s+k\s*=/,
  /class\s*Name\s*=/,
  /styl\s*e\s*=/,
  /prevent\s*Default/,
  /stopPropagat\s*ion/,
  /background\s*Color\s*:/,
  /paddi\s*ng\s*:/,
  /margi\s*n\s*:/,
];

let visited = 0, flagged = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(p); continue; }
    if (!exts.has(path.extname(entry.name))) continue;
    visited++;
    const src = fs.readFileSync(p, "utf8");
    for (const re of suspicious) {
      if (re.test(src)) {
        console.log("suspicious:", p, "pattern:", re);
        flagged++;
        break;
      }
    }
  }
}

walk(ROOT);
console.log(`visited ${visited} files; flagged ${flagged}`);





