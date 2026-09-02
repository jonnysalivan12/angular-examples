#!/usr/bin/env node
/**
 * Linter relacji między dokumentami.
 *
 * Czyta katalog z plikami .md (front matter YAML + treść), buduje graf
 * z pola `relations` i sprawdza go względem identyfikatorów użytych w treści.
 *
 * Stare pola `source-spec-ids` i `related-doc-ids` są ignorowane.
 *
 * Użycie:
 *     node lint-relations.js <katalog> [--strict]
 *
 * Zależności: js-yaml  (npm install js-yaml)
 * Wynik: raport tekstowy na stdout. Kod wyjścia 1, gdy są błędy.
 */

"use strict";

const fs = require("fs");
const path = require("path");

let yaml;
try {
  yaml = require("js-yaml");
} catch {
  console.error("Brak modułu js-yaml. Zainstaluj: npm install js-yaml");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Słownik standardu
// ---------------------------------------------------------------------------

const RELATION_TYPES = new Set([
  "defines", "realizes", "constrained-by", "uses-data", "consumes",
  "involves", "used-in", "contains", "groups", "precedes", "supersedes",
]);

// Prefiks doc-id → skrót typu (dłuższe pierwsze, żeby SPEC-WF nie złapało się jako SPEC)
const DOC_PREFIXES = [
  "SPEC-WF", "SCRSEC", "UCMAP", "ACTOR", "BPMN", "FLOW", "TUC", "DDM",
  "LDM", "ENT", "CAP", "NFR", "API", "INT", "QUE", "ACT", "STM", "SCR",
  "NAV", "ADR", "BFS", "UC",
];

const TYPE_FIELD_TO_PREFIX = {
  "business-functional-spec": "BFS",
  "use-case": "UC",
  "technical-use-case": "TUC",
  "use-case-technical-map": "UCMAP",
  "actor": "ACTOR",
  "ddm": "DDM",
  "ldm": "LDM",
  "ldm-entity": "ENT",
  "capability": "CAP",
  "non-functional-requirements": "NFR",
  "api": "API",
  "integration": "INT",
  "event": "QUE",
  "flow": "FLOW",
  "activity": "ACT",
  "state-machine": "STM",
  "screen": "SCR",
  "screen-section": "SCRSEC",
  "navigation-map": "NAV",
  "bpmn-process": "BPMN",
  "workflow-step": "SPEC-WF",
  "adr": "ADR",
};

// Identyfikatory lokalne: który typ dokumentu je definiuje i jaki mają wzorzec
const LOCAL_ID_OWNERS = {
  "BFS": [/REQ-\d+/g, /RB-\d+/g],
  "DDM": [/DOM-[A-Za-z][\w-]*/g, /RD-\d+/g],
  "LDM": [/RW-\d+/g],
  "NFR": [/NFR-[A-Z]+-\d+/g],
  "ACTOR": [/ACTOR-\d{1,2}(?!\d)/g],
  "SPEC-WF": [/AC-\d+/g],
};
// Warianty A1/E1 — tylko z nagłówków
const VARIANT_HEADING = /^#{2,4}\s+([AE]\d+)\s*[:.]/gm;

// Sugerowany typ relacji dla pary (typ źródła → typ celu)
const PAIR_TO_TYPE = new Map([
  ["BFS→NFR", "constrained-by"],
  ["UC→BFS", "realizes"], ["TUC→BFS", "realizes"],
  ["UC→CAP", "realizes"], ["TUC→CAP", "realizes"],
  ["UC→ACTOR", "involves"], ["TUC→ACTOR", "involves"],
  ["CAP→BFS", "realizes"],
  ["CAP→QUE", "consumes"],
  ["API→CAP", "realizes"], ["INT→CAP", "realizes"], ["QUE→CAP", "realizes"],
  ["API→UC", "used-in"], ["API→TUC", "used-in"],
  ["INT→UC", "used-in"], ["INT→TUC", "used-in"],
  ["QUE→UC", "used-in"], ["QUE→TUC", "used-in"],
  ["API→ENT", "uses-data"], ["SCRSEC→ENT", "uses-data"],
  ["LDM→DDM", "realizes"],
  ["LDM→ENT", "contains"],
  ["ENT→DDM", "realizes"],
  ["ENT→ENT", "contains"],
  ["STM→DDM", "realizes"],
  ["SCR→SCRSEC", "contains"],
  ["SCR→UC", "used-in"], ["SCR→TUC", "used-in"],
  ["NAV→SCR", "groups"],
  ["UCMAP→UC", "groups"], ["UCMAP→TUC", "groups"],
  ["FLOW→ACT", "contains"],
  ["FLOW→API", "consumes"], ["FLOW→INT", "consumes"], ["FLOW→QUE", "consumes"],
  ["BPMN→SPEC-WF", "contains"],
  ["SPEC-WF→SPEC-WF", "precedes"],
  ["SPEC-WF→API", "consumes"], ["SPEC-WF→INT", "consumes"], ["SPEC-WF→QUE", "consumes"],
  ["ADR→ADR", "supersedes"],
]);

function suggestType(src, dst) {
  const key = `${src}→${dst}`;
  if (PAIR_TO_TYPE.has(key)) return PAIR_TO_TYPE.get(key);
  if (dst === "NFR" || dst === "ADR") return "constrained-by";
  return null;
}

// ---------------------------------------------------------------------------
// Parsowanie
// ---------------------------------------------------------------------------

const FRONT_MATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const CODE_FENCE = /```[\s\S]*?```/g;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PREFIX_ALT = DOC_PREFIXES.map(esc).join("|");
const DOC_ID_RE = new RegExp(`\\b(${PREFIX_ALT})-(\\d{3,}|[A-Z][A-Za-z]+)\\b`, "g");
const PREFIXED_LOCAL_RE = new RegExp(
  `\\b((?:${PREFIX_ALT})-(?:\\d{3,}|[A-Z][A-Za-z]+))\\.([A-Z]+-[\\w-]+)\\b`, "g"
);

function matchAll(re, text) {
  re.lastIndex = 0;
  return [...text.matchAll(re)];
}

class Doc {
  constructor(file, meta, body) {
    this.path = file;
    this.meta = meta || {};
    this.body = body;
    this.docId = String(this.meta["doc-id"] || "").trim();
    this.kind = this.resolveKind();
    this.badRelations = false;
    this.badEntries = [];
    this.relations = this.parseRelations();
    this.errors = [];
    this.warnings = [];
    this.infos = [];
  }

  resolveKind() {
    const t = this.meta.type;
    if (t && TYPE_FIELD_TO_PREFIX[t]) return TYPE_FIELD_TO_PREFIX[t];
    for (const p of DOC_PREFIXES) {
      if (this.docId.startsWith(p + "-")) return p;
    }
    return null;
  }

  parseRelations() {
    const raw = this.meta.relations || [];
    if (!Array.isArray(raw)) {
      this.badRelations = true;
      return [];
    }
    const out = [];
    for (const r of raw) {
      if (r && typeof r === "object" && "type" in r && "target" in r) {
        out.push({ type: String(r.type).trim(), target: String(r.target).trim() });
      } else {
        this.badEntries.push(r);
      }
    }
    return out;
  }

  cleanBody() {
    return this.body.replace(HTML_COMMENT, "").replace(CODE_FENCE, "");
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
      out.push(full);
    }
  }
  return out.sort();
}

function loadDocs(root) {
  const docs = new Map();
  const skipped = [];
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    const m = FRONT_MATTER.exec(text);
    if (!m) {
      skipped.push([file, "brak front matter"]);
      continue;
    }
    let meta;
    try {
      meta = yaml.load(m[1]) || {};
    } catch (e) {
      skipped.push([file, `błąd YAML: ${e.message}`]);
      continue;
    }
    const d = new Doc(file, meta, m[2]);
    if (!d.docId) {
      skipped.push([file, "brak doc-id"]);
      continue;
    }
    if (d.docId.startsWith("TPL-")) continue;
    if (docs.has(d.docId)) {
      d.errors.push(`duplikat doc-id \`${d.docId}\` — także w ${docs.get(d.docId).path}`);
    }
    docs.set(d.docId, d);
  }
  return { docs, skipped };
}

// ---------------------------------------------------------------------------
// Reguły
// ---------------------------------------------------------------------------

function kindOfTarget(target, docs) {
  const dot = target.indexOf(".");
  if (dot !== -1) {
    const docPart = target.slice(0, dot);
    const local = target.slice(dot + 1);
    const d = docs.get(docPart);
    return { kind: d ? d.kind : null, docId: docPart, local };
  }
  const d = docs.get(target);
  return { kind: d ? d.kind : null, docId: target, local: null };
}

function checkDocument(doc, docs, allDefined) {
  const body = doc.cleanBody();
  const declared = new Set(doc.relations.map((r) => r.target));

  // R1: poprawność wpisów relations
  if (doc.badRelations) doc.errors.push("pole `relations` nie jest listą");
  for (const bad of doc.badEntries) {
    doc.errors.push(`wpis w \`relations\` bez \`type\` lub \`target\`: ${JSON.stringify(bad)}`);
  }
  for (const { type, target } of doc.relations) {
    if (!RELATION_TYPES.has(type)) {
      doc.errors.push(`nieznany typ relacji \`${type}\` → ${target}`);
    }
  }

  // R2: cel relacji istnieje
  for (const { type, target } of doc.relations) {
    if (type === "defines") continue;
    const { docId, local } = kindOfTarget(target, docs);
    if (!docs.has(docId)) {
      doc.errors.push(`cel nie istnieje: \`${target}\` (relacja \`${type}\`)`);
    } else if (local && !allDefined.has(target)) {
      doc.errors.push(`cel \`${target}\` nie jest zadeklarowany przez \`defines\` w ${docId}`);
    }
  }

  // R3: własne identyfikatory lokalne muszą mieć `defines`
  const ownLocal = new Set();
  for (const re of LOCAL_ID_OWNERS[doc.kind] || []) {
    for (const m of matchAll(re, body)) ownLocal.add(m[0]);
  }
  if (doc.kind === "UC" || doc.kind === "TUC") {
    for (const m of matchAll(VARIANT_HEADING, body)) ownLocal.add(m[1]);
  }
  const definedHere = new Set(doc.relations.filter((r) => r.type === "defines").map((r) => r.target));
  for (const lid of [...ownLocal].filter((x) => !definedHere.has(x)).sort()) {
    doc.errors.push(`identyfikator \`${lid}\` w treści bez wpisu \`defines\``);
  }
  for (const lid of [...definedHere].filter((x) => !ownLocal.has(x)).sort()) {
    doc.warnings.push(`\`defines: ${lid}\` bez śladu w treści`);
  }

  // R4: identyfikatory innych dokumentów w treści muszą mieć relację
  const mentioned = new Set();
  const prefixedSpans = [];
  for (const m of matchAll(PREFIXED_LOCAL_RE, body)) {
    mentioned.add(m[0]);
    prefixedSpans.push([m.index, m.index + m[0].length]);
  }
  for (const m of matchAll(DOC_ID_RE, body)) {
    const did = m[0];
    if (prefixedSpans.some(([a, b]) => a <= m.index && m.index < b)) continue;
    if (did !== doc.docId && docs.has(did)) mentioned.add(did);
  }
  const declaredDocs = new Set([...declared].map((t) => t.split(".")[0]));
  for (const target of [...mentioned].sort()) {
    if (declared.has(target)) continue;
    if (!target.includes(".") && declaredDocs.has(target)) continue;
    const { kind: tkind, docId } = kindOfTarget(target, docs);
    if (!docs.has(docId)) {
      doc.errors.push(`w treści \`${target}\`, ale taki dokument nie istnieje`);
      continue;
    }
    const stype = suggestType(doc.kind, tkind);
    const hint = stype
      ? `dodaj \`- type: ${stype}\` / \`target: ${target}\``
      : `standard nie przewiduje relacji ${doc.kind} → ${tkind}; usuń odwołanie z treści albo zadeklaruj je po stronie ${tkind}`;
    doc.errors.push(`w treści \`${target}\` bez relacji — ${hint}`);
  }

  // R5: identyfikatory lokalne bez prefiksu — stan „w trakcie"
  const unprefixed = new Set();
  for (const [kind, patterns] of Object.entries(LOCAL_ID_OWNERS)) {
    if (kind === doc.kind) continue;
    for (const re of patterns) {
      for (const m of matchAll(re, body)) {
        if (m.index > 0 && body[m.index - 1] === ".") continue;
        unprefixed.add(m[0]);
      }
    }
  }
  for (const lid of [...unprefixed].sort()) {
    doc.infos.push(`w trakcie: \`${lid}\` bez prefiksu dokumentu — nie da się rozwiązać`);
  }

  // R6: pary spoza macierzy
  for (const { type, target } of doc.relations) {
    if (type === "defines" || !RELATION_TYPES.has(type)) continue;
    const { kind: tkind } = kindOfTarget(target, docs);
    const expected = tkind ? suggestType(doc.kind, tkind) : null;
    if (expected && expected !== type) {
      doc.warnings.push(
        `\`${type}\` → ${target}: dla pary ${doc.kind} → ${tkind} standard przewiduje \`${expected}\``
      );
    }
  }
}

function checkConnectivity(docs) {
  const adj = new Map();
  const nodes = new Set(docs.keys());
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  };
  for (const d of docs.values()) {
    for (const { type, target } of d.relations) {
      const node = type === "defines" ? `${d.docId}.${target}` : target;
      nodes.add(node);
      link(d.docId, node);
    }
  }
  const seen = new Set();
  const components = [];
  for (const n of [...nodes].sort()) {
    if (seen.has(n)) continue;
    const comp = new Set();
    const stack = [n];
    while (stack.length) {
      const x = stack.pop();
      if (comp.has(x)) continue;
      comp.add(x);
      for (const y of adj.get(x) || []) if (!comp.has(y)) stack.push(y);
    }
    for (const x of comp) seen.add(x);
    components.push(comp);
  }
  components.sort((a, b) => b.size - a.size);
  return components;
}

// ---------------------------------------------------------------------------
// Raport
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const root = args.find((a) => !a.startsWith("--"));
  const strict = args.includes("--strict");
  if (!root) {
    console.error("Użycie: node lint-relations.js <katalog> [--strict]");
    process.exit(2);
  }

  const { docs, skipped } = loadDocs(root);
  if (docs.size === 0) {
    console.error("Nie znaleziono dokumentów z doc-id.");
    process.exit(2);
  }

  const allDefined = new Set();
  for (const d of docs.values()) {
    for (const { type, target } of d.relations) {
      if (type === "defines") allDefined.add(`${d.docId}.${target}`);
    }
  }

  for (const d of docs.values()) checkDocument(d, docs, allDefined);

  let nErr = 0, nWarn = 0, nInfo = 0;
  for (const did of [...docs.keys()].sort()) {
    const d = docs.get(did);
    if (!d.errors.length && !d.warnings.length && !d.infos.length) continue;
    console.log(`\n${did}  (${d.path})`);
    for (const e of d.errors) console.log(`  BŁĄD   ${e}`);
    for (const w of d.warnings) console.log(`  UWAGA  ${w}`);
    for (const i of d.infos) console.log(`  INFO   ${i}`);
    nErr += d.errors.length;
    nWarn += d.warnings.length;
    nInfo += d.infos.length;
  }

  const components = checkConnectivity(docs);
  if (components.length > 1) {
    console.log("\nSPÓJNOŚĆ (U-003)");
    console.log(`  główna składowa: ${components[0].size} węzłów`);
    const islands = components.slice(1);
    console.log(`  poza nią: ${islands.length} składowych`);
    for (const comp of islands.slice(0, 20)) {
      const ids = [...comp].filter((x) => docs.has(x)).sort();
      console.log(`    ${ids.length ? ids.join(", ") : "(tylko identyfikatory lokalne)"}`);
    }
    if (islands.length > 20) console.log(`    … i ${islands.length - 20} więcej`);
    if (strict) nErr += islands.length;
  }

  if (skipped.length) {
    console.log("\nPOMINIĘTE");
    for (const [p, why] of skipped) console.log(`  ${p}: ${why}`);
  }

  console.log(`\n${docs.size} dokumentów · ${nErr} błędów · ${nWarn} uwag · ${nInfo} w trakcie`);
  process.exit(nErr ? 1 : 0);
}

main();
