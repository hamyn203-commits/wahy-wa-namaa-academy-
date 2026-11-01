#!/usr/bin/env node
/**
 * Design-token ratchet — Wahy Wa Namaa Academy
 *
 * Counts raw design values (hex colours, rgb/rgba(), fixed font-sizes,
 * fixed px radii, !important) outside the token source of truth
 * (src/styles/brand.css) and compares them with a committed baseline.
 *
 * Rule: counts may only go DOWN. Any file whose count rises above its
 * baseline fails the check. New files start with a baseline of 0.
 *
 * Usage:
 *   node scripts/design-token-scan.mjs            # check against baseline
 *   node scripts/design-token-scan.mjs --update   # rewrite baseline (only after reductions)
 *   node scripts/design-token-scan.mjs --report   # print table, never fail
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', 'design-token-baseline.json');

/** Files allowed to hold raw values (token definitions). */
const TOKEN_SOURCES = new Set(['src/styles/brand.css']);

const METRICS = {
  hex: /#[0-9a-fA-F]{3,8}\b/g,
  rgba: /\brgba?\(/g,
  fontSize: /font-size:\s*[\d.]+(?:px|rem|em)\b/g,
  radiusPx: /border-radius:\s*[\d.]+px\b/g,
  important: /!important/g,
};

/** JSX/JS only tracks colour literals (inline styles, arbitrary Tailwind). */
const JSX_METRICS = {
  hex: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?=['"\]\s;,)])/g,
};

const args = new Set(process.argv.slice(2));
const UPDATE = args.has('--update');
const REPORT = args.has('--report');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(css|jsx|js|tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function count(text, regex) {
  return (text.match(regex) || []).length;
}

function scan() {
  const result = {};
  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file).split(sep).join('/');
    if (TOKEN_SOURCES.has(rel)) continue;
    const isCss = rel.endsWith('.css');
    const raw = readFileSync(file, 'utf8');
    const text = isCss ? stripCssComments(raw) : raw;
    const metrics = isCss ? METRICS : JSX_METRICS;
    const counts = {};
    let total = 0;
    for (const [key, re] of Object.entries(metrics)) {
      const n = count(text, re);
      if (n) counts[key] = n;
      total += n;
    }
    if (total) result[rel] = counts;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function totals(map) {
  const t = {};
  for (const counts of Object.values(map)) {
    for (const [k, v] of Object.entries(counts)) t[k] = (t[k] || 0) + v;
  }
  return t;
}

const current = scan();

if (UPDATE) {
  if (existsSync(BASELINE_PATH)) {
    const prev = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files || {};
    const raised = [];
    for (const [file, counts] of Object.entries(current)) {
      for (const [k, v] of Object.entries(counts)) {
        const before = prev[file]?.[k] ?? 0;
        if (v > before) raised.push(`${file} ${k}: ${before} → ${v}`);
      }
    }
    if (raised.length && !args.has('--force')) {
      console.error('✖ Refusing to raise the baseline. Increases found:\n  ' + raised.join('\n  '));
      console.error('  Replace raw values with var(--wn-*) tokens, or pass --force with a reviewed reason.');
      process.exit(1);
    }
  }
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ generatedBy: 'scripts/design-token-scan.mjs', totals: totals(current), files: current }, null, 2) + '\n',
  );
  console.log('✔ Baseline written:', totals(current));
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files || {}
  : {};

const regressions = [];
const improvements = [];
const allFiles = new Set([...Object.keys(current), ...Object.keys(baseline)]);
for (const file of allFiles) {
  const cur = current[file] || {};
  const base = baseline[file] || {};
  const keys = new Set([...Object.keys(cur), ...Object.keys(base)]);
  for (const k of keys) {
    const a = base[k] ?? 0;
    const b = cur[k] ?? 0;
    if (b > a) regressions.push({ file, metric: k, before: a, after: b });
    else if (b < a) improvements.push({ file, metric: k, before: a, after: b });
  }
}

const curTotals = totals(current);
const baseTotals = totals(baseline);
console.log('Design-token scan (raw values outside brand.css)');
for (const k of new Set([...Object.keys(curTotals), ...Object.keys(baseTotals)])) {
  console.log(`  ${k.padEnd(10)} ${String(baseTotals[k] ?? 0).padStart(5)} → ${String(curTotals[k] ?? 0).padStart(5)}`);
}

if (REPORT) {
  const rows = Object.entries(current)
    .map(([f, c]) => [f, Object.values(c).reduce((s, n) => s + n, 0), c])
    .sort((x, y) => y[1] - x[1]);
  for (const [f, n, c] of rows) console.log(`  ${String(n).padStart(5)}  ${f}  ${JSON.stringify(c)}`);
  process.exit(0);
}

if (improvements.length) {
  console.log(`✔ ${improvements.length} reduction(s). Run "npm run design:scan:update" to lock them in.`);
}

if (regressions.length) {
  console.error(`✖ ${regressions.length} design-token regression(s):`);
  for (const r of regressions) console.error(`  ${r.file}  ${r.metric}: ${r.before} → ${r.after}`);
  console.error('  Use var(--wn-*) tokens from src/styles/brand.css instead of raw values.');
  process.exit(1);
}

console.log('✔ No design-token regressions.');

