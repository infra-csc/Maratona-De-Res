#!/usr/bin/env node
// Verifica se toda rota Express do api-server está declarada no contrato
// OpenAPI (lib/api-spec/openapi.yaml). Node puro, sem dependências.
//
// Uso: node scripts/check-api-contract.mjs
// Sai com código 1 se alguma rota Express não estiver no spec.
// Rotas do spec sem handler Express são apenas avisadas (não falham).

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "artifacts", "api-server", "src", "routes");
const specPath = join(root, "lib", "api-spec", "openapi.yaml");

const METHODS = ["get", "post", "put", "patch", "delete"];

// Normaliza parâmetros para comparar só a forma do path:
//   Express  /events/:id/criteria/:ecId   /storage/objects/*path
//   OpenAPI  /events/{id}/criteria/{ecId} /storage/objects/{objectPath}
// → /events/{}/criteria/{}  e  /storage/objects/{}
function normalize(path) {
  return path
    .replace(/\{[^}]+\}/g, "{}")
    .replace(/:[A-Za-z0-9_]+/g, "{}")
    .replace(/\*[A-Za-z0-9_]*/g, "{}")
    .replace(/\/+$/, "") || "/";
}

// ── Rotas Express ──────────────────────────────────────────────────────────
const routeRe = /router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
const express = new Map(); // chave "METHOD {path}" → origem
for (const file of readdirSync(routesDir).sort()) {
  if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
  const src = readFileSync(join(routesDir, file), "utf8");
  for (const m of src.matchAll(routeRe)) {
    const method = m[1].toUpperCase();
    const key = `${method} ${normalize(m[2])}`;
    const line = src.slice(0, m.index).split("\n").length;
    if (!express.has(key)) express.set(key, `${file}:${line} ${method} ${m[2]}`);
  }
}

// ── Paths do OpenAPI (parser mínimo do bloco `paths:`) ─────────────────────
const specLines = readFileSync(specPath, "utf8").split(/\r?\n/);
const spec = new Map();
let inPaths = false;
let currentPath = null;
for (const line of specLines) {
  if (/^paths:\s*$/.test(line)) { inPaths = true; continue; }
  if (inPaths && /^\S/.test(line)) { inPaths = false; currentPath = null; }
  if (!inPaths) continue;
  const p = line.match(/^  (\/[^:]*):\s*$/) ?? line.match(/^  ["'](\/[^"']*)["']:\s*$/);
  if (p) { currentPath = p[1]; continue; }
  const m = line.match(/^    (get|post|put|patch|delete):\s*$/);
  if (m && currentPath) {
    const method = m[1].toUpperCase();
    spec.set(`${method} ${normalize(currentPath)}`, `${method} ${currentPath}`);
  }
}

const missing = [...express.keys()].filter((k) => !spec.has(k)).sort();
const orphan = [...spec.keys()].filter((k) => !express.has(k)).sort();

console.log(`Rotas Express: ${express.size} · operações no OpenAPI: ${spec.size}`);
if (orphan.length) {
  console.log(`\nAviso: ${orphan.length} operação(ões) no spec sem rota Express correspondente:`);
  for (const k of orphan) console.log(`  - ${spec.get(k)}`);
}
if (missing.length) {
  console.log(`\n${missing.length} rota(s) Express sem declaração no openapi.yaml:`);
  for (const k of missing) console.log(`  - ${express.get(k)}`);
  process.exit(1);
}
console.log("\nContrato OK: todas as rotas Express estão declaradas no openapi.yaml.");
