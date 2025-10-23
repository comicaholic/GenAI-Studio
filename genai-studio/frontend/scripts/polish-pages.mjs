import fs from "fs";
import path from "path";
import glob from "fast-glob";

const ROOT = path.resolve("src/pages");
const files = await glob(["**/*.{tsx,jsx}"], { cwd: ROOT, dot: true });

function addTokensToClass(txt, tokens) {
  const parts = new Set(txt.split(/\s+/).filter(Boolean));
  for (const t of tokens.split(/\s+/)) parts.add(t);
  return [...parts].join(" ");
}

function patchTag(source, tag, tokens, { predicate } = {}) {
  return source.replace(
    new RegExp(`<${tag}\\b([^<>]*?)>`, "gsi"),
    (full, attrs) => {
      if (/className\s*=\s*\{/.test(attrs)) return full; // skip expressions
      if (predicate) {
        // Build a tiny attrs map (best-effort for string-literals)
        const map = {};
        for (const m of attrs.matchAll(/(\w+)\s*=\s*"(.*?)"/g)) map[m[1]] = m[2];
        if (!predicate(map)) return full;
      }
      const m = attrs.match(/className\s*=\s*"(.*?)"/);
      let newAttrs;
      if (m) {
        const next = addTokensToClass(m[1], tokens);
        if (next === m[1]) return full;
        newAttrs = attrs.replace(m[0], `className="${next}"`);
      } else {
        newAttrs = ` className="${tokens}"${attrs ? " " + attrs.trim() : ""}`;
      }
      return `<${tag}${newAttrs}>`;
    }
  );
}

function isTextInput(map) {
  const t = (map?.type || "").toLowerCase();
  return !["checkbox","radio","range","file","color","hidden","image"].includes(t);
}

let total = 0;
for (const rel of files) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, "utf8");
  const o = s;

  // Page & headings
  s = patchTag(s, "main", "container-page py-6 space-y-6");
  s = patchTag(s, "h1", "text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100");
  s = patchTag(s, "h2", "text-lg font-semibold text-neutral-900 dark:text-neutral-100");
  s = patchTag(s, "h3", "text-base font-semibold text-neutral-900 dark:text-neutral-100");

  // Controls
  s = patchTag(s, "button", "h-10 min-w-[96px]");
  s = patchTag(s, "input", "h-10 text-sm", { predicate: isTextInput });
  s = patchTag(s, "select", "h-10 text-sm");
  s = patchTag(s, "textarea", "text-sm min-h-32");

  // Tables
  s = patchTag(s, "table", "w-full text-sm");
  s = patchTag(s, "thead", "bg-neutral-50 dark:bg-neutral-800 text-left");
  s = patchTag(s, "tbody", "divide-y divide-neutral-200/60 dark:divide-neutral-700/60");
  s = patchTag(s, "th", "px-4 py-3 font-medium");
  s = patchTag(s, "td", "px-4 py-3 align-top");

  if (s !== o) {
    fs.writeFileSync(p, s, "utf8");
    total++;
  }
}

console.log(`Polished ${total} file(s).`);
