#!/usr/bin/env python3
"""
Linter relacji między dokumentami.

Czyta katalog z plikami .md (front matter YAML + treść), buduje graf
z pola `relations` i sprawdza go względem identyfikatorów użytych w treści.

Stare pola `source-spec-ids` i `related-doc-ids` są ignorowane.

Użycie:
    python lint_relations.py <katalog> [--strict]

Wynik: raport tekstowy na stdout. Kod wyjścia 1, gdy są błędy.
"""

import re
import sys
from collections import defaultdict
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("Brak modułu PyYAML. Zainstaluj: pip install pyyaml")

# ---------------------------------------------------------------------------
# Słownik standardu
# ---------------------------------------------------------------------------

RELATION_TYPES = {
    "defines", "realizes", "constrained-by", "uses-data", "consumes",
    "involves", "used-in", "contains", "groups", "precedes", "supersedes",
}

# Prefiks doc-id → skrót typu
DOC_PREFIXES = [
    "SPEC-WF", "SCRSEC", "UCMAP", "ACTOR", "BPMN", "FLOW", "TUC", "DDM",
    "LDM", "ENT", "CAP", "NFR", "API", "INT", "QUE", "ACT", "STM", "SCR",
    "NAV", "ADR", "BFS", "UC",
]

# Pole `type` z front matter → skrót typu
TYPE_FIELD_TO_PREFIX = {
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
}

# Identyfikatory lokalne: który typ dokumentu je definiuje i jaki mają wzorzec
LOCAL_ID_OWNERS = {
    "BFS": [r"REQ-\d+", r"RB-\d+"],
    "DDM": [r"DOM-[A-Za-z][\w-]*", r"RD-\d+"],
    "LDM": [r"RW-\d+"],
    "NFR": [r"NFR-[A-Z]+-\d+"],
    "ACTOR": [r"ACTOR-\d{1,2}(?!\d)"],
    "SPEC-WF": [r"AC-\d+"],
}
# Warianty A1/E1 — tylko z nagłówków, bo same litery są zbyt ogólne
VARIANT_HEADING = re.compile(r"^#{2,4}\s+([AE]\d+)\s*[:.]", re.MULTILINE)

# Sugerowany typ relacji dla pary (typ źródła, typ celu)
PAIR_TO_TYPE = {
    ("BFS", "NFR"): "constrained-by",
    ("UC", "BFS"): "realizes", ("TUC", "BFS"): "realizes",
    ("UC", "CAP"): "realizes", ("TUC", "CAP"): "realizes",
    ("UC", "ACTOR"): "involves", ("TUC", "ACTOR"): "involves",
    ("CAP", "BFS"): "realizes",
    ("CAP", "QUE"): "consumes",
    ("API", "CAP"): "realizes", ("INT", "CAP"): "realizes", ("QUE", "CAP"): "realizes",
    ("API", "UC"): "used-in", ("API", "TUC"): "used-in",
    ("INT", "UC"): "used-in", ("INT", "TUC"): "used-in",
    ("QUE", "UC"): "used-in", ("QUE", "TUC"): "used-in",
    ("API", "ENT"): "uses-data", ("SCRSEC", "ENT"): "uses-data",
    ("LDM", "DDM"): "realizes",
    ("LDM", "ENT"): "contains",
    ("ENT", "DDM"): "realizes",
    ("ENT", "ENT"): "contains",
    ("STM", "DDM"): "realizes",
    ("SCR", "SCRSEC"): "contains",
    ("SCR", "UC"): "used-in", ("SCR", "TUC"): "used-in",
    ("NAV", "SCR"): "groups",
    ("UCMAP", "UC"): "groups", ("UCMAP", "TUC"): "groups",
    ("FLOW", "ACT"): "contains",
    ("FLOW", "API"): "consumes", ("FLOW", "INT"): "consumes", ("FLOW", "QUE"): "consumes",
    ("BPMN", "SPEC-WF"): "contains",
    ("SPEC-WF", "SPEC-WF"): "precedes",
    ("SPEC-WF", "API"): "consumes", ("SPEC-WF", "INT"): "consumes", ("SPEC-WF", "QUE"): "consumes",
    ("ADR", "ADR"): "supersedes",
}


def suggest_type(src, dst):
    if (src, dst) in PAIR_TO_TYPE:
        return PAIR_TO_TYPE[(src, dst)]
    if dst == "NFR" or dst == "ADR":
        return "constrained-by"
    return None


# ---------------------------------------------------------------------------
# Parsowanie
# ---------------------------------------------------------------------------

FRONT_MATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?(.*)\Z", re.DOTALL)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
CODE_FENCE = re.compile(r"```.*?```", re.DOTALL)

DOC_ID_RE = re.compile(
    r"\b(" + "|".join(re.escape(p) for p in DOC_PREFIXES) + r")-(\d{3,}|[A-Z][A-Za-z]+)\b"
)
PREFIXED_LOCAL_RE = re.compile(
    r"\b((?:" + "|".join(re.escape(p) for p in DOC_PREFIXES) + r")-(?:\d{3,}|[A-Z][A-Za-z]+))"
    r"\.([A-Z]+-[\w-]+)\b"
)


class Doc:
    def __init__(self, path, meta, body):
        self.path = path
        self.meta = meta or {}
        self.body = body
        self.doc_id = str(self.meta.get("doc-id", "")).strip()
        self.kind = self._resolve_kind()
        self.relations = self._parse_relations()
        self.errors, self.warnings, self.infos = [], [], []

    def _resolve_kind(self):
        t = self.meta.get("type")
        if t in TYPE_FIELD_TO_PREFIX:
            return TYPE_FIELD_TO_PREFIX[t]
        for p in DOC_PREFIXES:
            if self.doc_id.startswith(p + "-"):
                return p
        return None

    def _parse_relations(self):
        out = []
        raw = self.meta.get("relations") or []
        if not isinstance(raw, list):
            self.meta["_bad_relations"] = True
            return out
        for r in raw:
            if isinstance(r, dict) and "type" in r and "target" in r:
                out.append((str(r["type"]).strip(), str(r["target"]).strip()))
            else:
                self.meta.setdefault("_bad_entries", []).append(r)
        return out

    def clean_body(self):
        b = HTML_COMMENT.sub("", self.body)
        b = CODE_FENCE.sub("", b)
        return b


def load_docs(root):
    docs = {}
    skipped = []
    for p in sorted(Path(root).rglob("*.md")):
        if p.name.startswith("_"):
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        m = FRONT_MATTER.match(text)
        if not m:
            skipped.append((p, "brak front matter"))
            continue
        try:
            meta = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError as e:
            skipped.append((p, f"błąd YAML: {e}"))
            continue
        d = Doc(p, meta, m.group(2))
        if not d.doc_id:
            skipped.append((p, "brak doc-id"))
            continue
        if d.doc_id.startswith("TPL-"):
            continue
        if d.doc_id in docs:
            d.errors.append(f"duplikat doc-id `{d.doc_id}` — także w {docs[d.doc_id].path}")
        docs[d.doc_id] = d
    return docs, skipped


# ---------------------------------------------------------------------------
# Reguły
# ---------------------------------------------------------------------------

def kind_of_target(target, docs):
    """Zwraca (skrót typu, doc-id celu, czy identyfikator lokalny)."""
    if "." in target:
        doc_part, local = target.split(".", 1)
        d = docs.get(doc_part)
        return (d.kind if d else None), doc_part, local
    d = docs.get(target)
    return (d.kind if d else None), target, None


def check_document(doc, docs, all_defined):
    body = doc.clean_body()
    declared = {t for _, t in doc.relations}

    # R1: poprawność wpisów relations
    if doc.meta.get("_bad_relations"):
        doc.errors.append("pole `relations` nie jest listą")
    for bad in doc.meta.get("_bad_entries", []):
        doc.errors.append(f"wpis w `relations` bez `type` lub `target`: {bad!r}")
    for rtype, target in doc.relations:
        if rtype not in RELATION_TYPES:
            doc.errors.append(f"nieznany typ relacji `{rtype}` → {target}")

    # R2: cel relacji istnieje
    for rtype, target in doc.relations:
        if rtype == "defines":
            continue
        tkind, tdoc, local = kind_of_target(target, docs)
        if tdoc not in docs:
            doc.errors.append(f"cel nie istnieje: `{target}` (relacja `{rtype}`)")
        elif local and target not in all_defined:
            doc.errors.append(
                f"cel `{target}` nie jest zadeklarowany przez `defines` w {tdoc}"
            )

    # R3: własne identyfikatory lokalne muszą mieć `defines`
    own_local = set()
    for pat in LOCAL_ID_OWNERS.get(doc.kind, []):
        own_local.update(re.findall(pat, body))
    if doc.kind in ("UC", "TUC"):
        own_local.update(VARIANT_HEADING.findall(body))
    defined_here = {t for r, t in doc.relations if r == "defines"}
    for lid in sorted(own_local - defined_here):
        doc.errors.append(f"identyfikator `{lid}` w treści bez wpisu `defines`")
    for lid in sorted(defined_here - own_local):
        doc.warnings.append(f"`defines: {lid}` bez śladu w treści")

    # R4: identyfikatory innych dokumentów w treści muszą mieć relację
    mentioned = set()
    prefixed_spans = []
    for m in PREFIXED_LOCAL_RE.finditer(body):
        prefixed_spans.append((m.start(), m.end()))
        if m.group(1) == doc.doc_id:
            continue  # własny identyfikator z prefiksem — sprawdza R3
        mentioned.add(m.group(0))
    for m in DOC_ID_RE.finditer(body):
        did = m.group(0)
        if any(a <= m.start() < b for a, b in prefixed_spans):
            continue  # część identyfikatora z prefiksem, obsłużona wyżej
        if did != doc.doc_id and did in docs:
            mentioned.add(did)
    declared_docs = {t.split(".", 1)[0] for t in declared}
    for target in sorted(mentioned):
        if target in declared:
            continue
        if "." not in target and target in declared_docs:
            continue  # relacja do identyfikatora lokalnego z tego dokumentu wystarcza
        tkind, tdoc, local = kind_of_target(target, docs)
        if tdoc not in docs:
            doc.errors.append(f"w treści `{target}`, ale taki dokument nie istnieje")
            continue
        stype = suggest_type(doc.kind, tkind)
        if stype:
            hint = f"dodaj `- type: {stype}` / `target: {target}`"
        else:
            hint = (f"standard nie przewiduje relacji {doc.kind} → {tkind}; "
                    f"usuń odwołanie z treści albo zadeklaruj je po stronie {tkind}")
        doc.errors.append(f"w treści `{target}` bez relacji — {hint}")

    # R5: identyfikatory lokalne bez prefiksu — stan „w trakcie"
    foreign_patterns = [
        pat for k, pats in LOCAL_ID_OWNERS.items() if k != doc.kind for pat in pats
    ]
    unprefixed = set()
    for pat in foreign_patterns:
        for m in re.finditer(pat, body):
            start = m.start()
            if start > 0 and body[start - 1] == ".":
                continue
            unprefixed.add(m.group(0))
    for lid in sorted(unprefixed):
        doc.infos.append(f"w trakcie: `{lid}` bez prefiksu dokumentu — nie da się rozwiązać")

    # R6: pary spoza macierzy
    for rtype, target in doc.relations:
        if rtype == "defines" or rtype not in RELATION_TYPES:
            continue
        tkind, _, _ = kind_of_target(target, docs)
        if tkind and suggest_type(doc.kind, tkind) not in (None, rtype):
            doc.warnings.append(
                f"`{rtype}` → {target}: dla pary {doc.kind} → {tkind} standard "
                f"przewiduje `{suggest_type(doc.kind, tkind)}`"
            )


def check_connectivity(docs):
    """U-003: każdy węzeł osiągalny. Graf nieskierowany z istniejących relacji."""
    adj = defaultdict(set)
    nodes = set(docs)
    for d in docs.values():
        for rtype, target in d.relations:
            node = f"{d.doc_id}.{target}" if rtype == "defines" else target
            nodes.add(node)
            adj[d.doc_id].add(node)
            adj[node].add(d.doc_id)
    seen, components = set(), []
    for n in sorted(nodes):
        if n in seen:
            continue
        comp, stack = set(), [n]
        while stack:
            x = stack.pop()
            if x in comp:
                continue
            comp.add(x)
            stack.extend(adj[x] - comp)
        seen |= comp
        components.append(comp)
    components.sort(key=len, reverse=True)
    return components


# ---------------------------------------------------------------------------
# Raport
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    root = sys.argv[1]
    strict = "--strict" in sys.argv

    docs, skipped = load_docs(root)
    if not docs:
        sys.exit("Nie znaleziono dokumentów z doc-id.")

    all_defined = set()
    for d in docs.values():
        for r, t in d.relations:
            if r == "defines":
                all_defined.add(f"{d.doc_id}.{t}")

    for d in docs.values():
        check_document(d, docs, all_defined)

    n_err = n_warn = n_info = 0
    for did in sorted(docs):
        d = docs[did]
        if not (d.errors or d.warnings or d.infos):
            continue
        print(f"\n{did}  ({d.path})")
        for e in d.errors:
            print(f"  BŁĄD   {e}")
        for w in d.warnings:
            print(f"  UWAGA  {w}")
        for i in d.infos:
            print(f"  INFO   {i}")
        n_err += len(d.errors)
        n_warn += len(d.warnings)
        n_info += len(d.infos)

    components = check_connectivity(docs)
    if len(components) > 1:
        print("\nSPÓJNOŚĆ (U-003)")
        print(f"  główna składowa: {len(components[0])} węzłów")
        islands = components[1:]
        print(f"  poza nią: {len(islands)} składowych")
        for comp in islands[:20]:
            ids = sorted(x for x in comp if x in docs)
            print(f"    {', '.join(ids) if ids else '(tylko identyfikatory lokalne)'}")
        if len(islands) > 20:
            print(f"    … i {len(islands) - 20} więcej")
        if strict:
            n_err += len(islands)

    if skipped:
        print("\nPOMINIĘTE")
        for p, why in skipped:
            print(f"  {p}: {why}")

    print(f"\n{len(docs)} dokumentów · {n_err} błędów · {n_warn} uwag · {n_info} w trakcie")
    sys.exit(1 if n_err else 0)


if __name__ == "__main__":
    main()
