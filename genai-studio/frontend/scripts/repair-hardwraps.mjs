// node frontend/scripts/repair-hardwraps.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Point directly at frontend/src regardless of CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../src");
const isDryRun = process.argv.includes("--dry") || process.argv.includes("-n");
const exts = new Set([".tsx", ".ts"]);

// Keywords to heal even if split by arbitrary whitespace/newlines
const keywords = [
  // React attrs/events
  "className","style","htmlFor","id","key","ref",
  "onClick","onChange","onSubmit","onKeyDown","onKeyUp","onKeyPress",
  "onMouseDown","onMouseUp","onMouseEnter","onMouseLeave",
  "onFocus","onBlur","onInput","onScroll",
  // common DOM/event methods
  "stopPropagation","preventDefault",
  // CSS-in-JS properties
  "padding","margin","marginTop","marginRight","marginBottom","marginLeft",
  "background","backgroundColor","border","borderRadius","display",
  "position","zIndex","flexDirection","justifyContent","alignItems","gap",
  "width","height","fontSize","lineHeight","textAlign",
  // misc
  "element","children"
];

// Regexes like c\s*l\s*a\s*s\s*N\s*a\s*m\s*e
const healers = keywords.map(w => [new RegExp(w.split("").join("\\s*"), "g"), w]);

let visited = 0, changed = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      continue;
    }
    if (!exts.has(path.extname(entry.name))) continue;

    visited++;
    let src = fs.readFileSync(p, "utf8");
    const before = src;

    // Targeted quick fixes
    src = src
      .replace(/onClic\s*k\s*=/g, "onClick=")
      .replace(/styl\s*e\s*=/g, "style=")
      .replace(/e\.stopPropagat\s*ion/g, "e.stopPropagation")
      .replace(/eleme\s*nt\s*:/g, "element:")
      .replace(/paddi\s*ng\s*:/g, "padding:");

    // General healers
    for (const [re, word] of healers) src = src.replace(re, word);

    if (src !== before) {
      if (!isDryRun) fs.writeFileSync(p, src);
      changed++;
      console.log((isDryRun ? "would fix:" : "fixed:"), p);
    }
  }
}

walk(ROOT);
console.log(`visited ${visited} files; changed ${changed}${isDryRun ? " (dry-run)" : ""}`);


