/**
 * arch-graph extract — builds the semantic architecture graph of the workspace
 * as a single JSON file (the contract consumed by the diagram viewer app).
 *
 * Levels: domain (from `domain:*` tag) → library (from project.json) → symbol
 * (state / action / effects / facade / api service / component / selector).
 *
 * Edge kinds:
 *   lib_dep     library → library                  (import graph via tsconfig paths)
 *   dispatches  symbol → action                    (store.dispatch(new X(...)))
 *   handles     action → state                     (@Action(X) method on @State class)
 *   triggers    action → effect method             (@Effect([X, Y]) decorator)
 *   emits       effect method → action             (dispatch inside the effect body)
 *   calls_api   symbol → api service method        (this.<injected api>.<m>(...))
 *   http        api service → endpoint             (this.http.<verb>(url))
 *   selects     symbol → selector                  (store.selectSignal(S) / select(S))
 *   uses        component/service → injected class (inject(X) of a workspace symbol)
 *
 * Matching is textual by design: the workspace uses one canonical spelling for
 * action paths (e.g. `AuthActions.Auth.Login.Request`) at the definition, the
 * @Action/@Effect decorators and every dispatch site. Dynamically dispatched
 * actions (passed as parameters) are NOT visible statically — the live NGXS
 * stream is the completeness check for this graph.
 *
 * Usage:
 *   node tools/arch-graph/extract.js [--out <path>] [--root <path>] [--pretty]
 *     --out     output JSON (default: node_modules/.cache/arch-graph.json)
 *     --root    workspace root to scan (default: cwd)
 *     --pretty  indent JSON for manual review
 *
 * Requirements: Node >= 22, workspace `typescript` package. No other deps.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

let ROOT = process.cwd();

function parseArgs(argv) {
  const a = { out: 'node_modules/.cache/arch-graph.json', root: null, pretty: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') a.out = argv[++i];
    else if (argv[i] === '--root') a.root = argv[++i];
    else if (argv[i] === '--pretty') a.pretty = true;
  }
  return a;
}

// --- workspace discovery -----------------------------------------------------

/** All project.json files under apps/ and libs/ → {name, tags, sourceRoot, root}. */
function discoverProjects() {
  const projects = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'project.json') {
        const p = JSON.parse(fs.readFileSync(full, 'utf-8'));
        if (!p.sourceRoot) continue; // e2e/docker-only targets
        projects.push({
          name: p.name,
          tags: p.tags ?? [],
          sourceRoot: p.sourceRoot.replace(/\\/g, '/'),
          root: path.dirname(path.relative(ROOT, full)).replace(/\\/g, '/'),
          projectType: p.projectType ?? 'library',
        });
      }
    }
  };
  for (const top of ['apps', 'libs']) {
    const dir = path.join(ROOT, top);
    if (fs.existsSync(dir)) walk(dir);
  }
  return projects;
}

const tagValue = (tags, prefix) => tags.find((t) => t.startsWith(prefix))?.slice(prefix.length) ?? null;

/** tsconfig.base.json paths → sorted [importPrefix, libSourcePath] pairs. */
function loadImportAliases() {
  const tsconfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'tsconfig.base.json'), 'utf-8'));
  const out = [];
  for (const [alias, targets] of Object.entries(tsconfig.compilerOptions?.paths ?? {})) {
    const target = (Array.isArray(targets) ? targets[0] : targets)?.replace(/\\/g, '/').replace(/^\.\//, '');
    if (target) out.push([alias.replace(/\/\*$/, ''), target]);
  }
  return out.sort((a, b) => b[0].length - a[0].length);
}

function listSourceFiles(sourceRoot) {
  const dir = path.join(ROOT, sourceRoot);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts') && !/\.(spec|test|stories)\.ts$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => path.join(dir, f));
}

// --- AST extraction ------------------------------------------------------------

const HTTP_VERBS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'request']);
const SELECT_METHODS = new Set(['select', 'selectSignal', 'selectOnce', 'selectSnapshot']);

const decoratorsOf = (node) => (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []);

/** Decorator call by name → its CallExpression, else null. */
function decoratorCall(node, name) {
  for (const d of decoratorsOf(node)) {
    if (ts.isCallExpression(d.expression) && d.expression.expression.getText() === name) return d.expression;
  }
  return null;
}

/** `new A.B.C(...)` expressions inside `node` (dispatch payloads). */
function collectNewExpressions(node, sf, out = []) {
  if (ts.isNewExpression(node)) out.push(node.expression.getText(sf));
  ts.forEachChild(node, (c) => collectNewExpressions(c, sf, out));
  return out;
}

/** UML visibility marker from TS modifiers / `#private` name. */
function visibilityOf(m) {
  const mods = ts.canHaveModifiers(m) ? (ts.getModifiers(m) ?? []) : [];
  if (mods.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword)) return '-';
  if (mods.some((x) => x.kind === ts.SyntaxKind.ProtectedKeyword)) return '#';
  if (m.name && ts.isPrivateIdentifier(m.name)) return '-';
  return '+';
}

const isStatic = (m) =>
  ts.canHaveModifiers(m) && (ts.getModifiers(m) ?? []).some((x) => x.kind === ts.SyntaxKind.StaticKeyword);

/** Collapsed source text of a type node (or '' when absent). */
const typeText = (typeNode, sf) => (typeNode ? typeNode.getText(sf).replace(/\s+/g, ' ') : '');

/** First sentence of a symbol's leading JSDoc, as a short note. */
function jsdocNote(node) {
  const raw = node.jsDoc?.[node.jsDoc.length - 1]?.comment;
  const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map((p) => p.text ?? '').join('') : '';
  if (!text) return null;
  const first = text.split(/(?<=[.!?])\s|\n/)[0].trim();
  return first.length > 80 ? first.slice(0, 77) + '…' : first || null;
}

/** Renders a method/signature's parameter list as `name: Type, …`. */
function paramList(params, sf) {
  return params.map((p) => p.name.getText(sf) + (p.type ? ': ' + typeText(p.type, sf) : '')).join(', ');
}

/**
 * Parses one source file into raw facts; symbol/edge resolution happens later,
 * once every file of every library has been seen.
 */
function extractFile(filePath, relPath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);
  const facts = { imports: [], actions: [], namespaceConsts: [], classes: [], interfaces: [] };
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const nsStack = [];

  const visitTop = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      facts.imports.push(node.moduleSpecifier.text);
    } else if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
      nsStack.push(node.name.getText(sf));
      node.body.statements.forEach(visitTop);
      nsStack.pop();
      return;
    } else if (ts.isVariableStatement(node) && nsStack.length > 0) {
      for (const decl of node.declarationList.declarations) {
        const id = [...nsStack, decl.name.getText(sf)].join('.');
        const init = decl.initializer;
        if (init && ts.isCallExpression(init) && init.expression.getText(sf) === 'ActionBuilder.define') {
          const typeArg = init.arguments[0];
          facts.actions.push({
            id,
            type: typeArg && ts.isStringLiteralLike(typeArg) ? typeArg.text : null,
            line: line(decl),
          });
        } else {
          facts.namespaceConsts.push({ id, line: line(decl) });
        }
      }
    } else if (ts.isClassDeclaration(node) && node.name) {
      facts.classes.push(extractClass(node, sf, line));
    } else if (ts.isInterfaceDeclaration(node) && node.name) {
      facts.interfaces.push(extractInterface(node, sf, line));
    }
    ts.forEachChild(node, (c) => {
      if (
        ts.isClassDeclaration(c) ||
        ts.isInterfaceDeclaration(c) ||
        ts.isModuleDeclaration(c) ||
        ts.isImportDeclaration(c) ||
        ts.isVariableStatement(c)
      )
        return;
      visitTop(c);
    });
  };

  sf.statements.forEach(visitTop);
  return facts;
}

function extractClass(node, sf, line) {
  const cls = {
    name: node.name.getText(sf),
    line: line(node),
    isComponent: !!decoratorCall(node, 'Component'),
    isInjectable: !!decoratorCall(node, 'Injectable'),
    stateName: null,
    extendsClause: null,
    injected: {}, // property name → type/class name
    actionHandlers: [], // {action, method}
    selectorMethods: [], // @Selector() static methods
    effects: [], // {method, triggers[], operator}
    dispatches: [], // {action, method}
    selects: [], // {selector, member}
    apiCalls: [], // {prop, method, fromMethod}
    httpCalls: [], // {verb, url, fromMethod}
    fields: [], // {vis, name, type} — UML card body
    methods: [], // {vis, name, params, ret}
    note: jsdocNote(node),
  };

  const stateDec = decoratorCall(node, 'State');
  if (stateDec) {
    const arg = stateDec.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) {
      for (const p of arg.properties) {
        if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'name') {
          cls.stateName = ts.isStringLiteralLike(p.initializer) ? p.initializer.text : p.initializer.getText(sf);
        }
      }
    }
  }
  for (const h of node.heritageClauses ?? []) {
    if (h.token === ts.SyntaxKind.ExtendsKeyword) cls.extendsClause = h.types[0]?.expression.getText(sf) ?? null;
  }

  // Injections: `prop = inject(X)` properties and constructor parameter types.
  for (const m of node.members) {
    if (ts.isPropertyDeclaration(m) && m.initializer) {
      let call = m.initializer;
      if (ts.isCallExpression(call) && call.expression.getText(sf) === 'inject' && call.arguments[0]) {
        cls.injected[m.name.getText(sf)] = call.arguments[0].getText(sf);
      }
    } else if (ts.isConstructorDeclaration(m)) {
      for (const p of m.parameters) {
        if (p.type && ts.isTypeReferenceNode(p.type)) cls.injected[p.name.getText(sf)] = p.type.typeName.getText(sf);
        // Parameter properties (constructor DI with a modifier) are real fields.
        if (ts.canHaveModifiers(p) && (ts.getModifiers(p) ?? []).length) {
          cls.fields.push({ vis: visibilityOf(p), name: p.name.getText(sf), type: typeText(p.type, sf) });
        }
      }
    }
  }

  for (const m of node.members) {
    if (!ts.isMethodDeclaration(m) && !ts.isPropertyDeclaration(m) && !ts.isGetAccessorDeclaration(m)) continue;
    const memberName = m.name.getText(sf);

    // UML card body: fields (properties/getters) and methods with signatures.
    if (ts.isMethodDeclaration(m)) {
      cls.methods.push({ vis: visibilityOf(m), name: memberName, params: paramList(m.parameters, sf), ret: typeText(m.type, sf) });
    } else {
      // Prefer the declared type; fall back to the injected token for `inject(X)`.
      const type = typeText(m.type, sf) || cls.injected[memberName] || '';
      cls.fields.push({ vis: visibilityOf(m), name: memberName + (ts.isGetAccessorDeclaration(m) ? '()' : ''), type });
    }

    const actionDec = ts.isMethodDeclaration(m) && decoratorCall(m, 'Action');
    if (actionDec) {
      const arg = actionDec.arguments[0];
      const refs = arg && ts.isArrayLiteralExpression(arg) ? arg.elements : arg ? [arg] : [];
      for (const r of refs) cls.actionHandlers.push({ action: r.getText(sf), method: memberName });
    }
    if (ts.isMethodDeclaration(m) && decoratorCall(m, 'Selector')) cls.selectorMethods.push(memberName);

    const effectDec = ts.isMethodDeclaration(m) && decoratorCall(m, 'Effect');
    if (effectDec) {
      const [actionsArg, optsArg] = effectDec.arguments;
      const triggers =
        actionsArg && ts.isArrayLiteralExpression(actionsArg) ? actionsArg.elements.map((e) => e.getText(sf)) : [];
      let operator = 'switchMap';
      if (optsArg && ts.isObjectLiteralExpression(optsArg)) {
        for (const p of optsArg.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'operator' && ts.isStringLiteralLike(p.initializer)) {
            operator = p.initializer.text;
          }
        }
      }
      cls.effects.push({ method: memberName, triggers, operator });
    }

    // Body scan: dispatch / select* / this.<injected>.<m>() / this.http.<verb>().
    const scan = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const callee = n.expression;
        const calleeName = callee.name.getText(sf);

        if (calleeName === 'dispatch') {
          for (const arg of n.arguments) {
            for (const target of collectNewExpressions(arg, sf)) {
              cls.dispatches.push({ action: target, method: memberName });
            }
          }
        } else if (SELECT_METHODS.has(calleeName) && n.arguments[0]) {
          cls.selects.push({ selector: n.arguments[0].getText(sf), member: memberName });
        } else if (ts.isPropertyAccessExpression(callee.expression) && callee.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const prop = callee.expression.name.getText(sf);
          const injectedType = cls.injected[prop];
          if (injectedType === 'HttpClient' || prop === 'http' || prop === 'httpClient') {
            if (HTTP_VERBS.has(calleeName)) {
              const urlArg = n.arguments[0];
              cls.httpCalls.push({ verb: calleeName.toUpperCase(), url: urlArg ? urlArg.getText(sf) : '?', fromMethod: memberName });
            }
          } else if (injectedType) {
            cls.apiCalls.push({ prop, type: injectedType, method: calleeName, fromMethod: memberName });
          }
        }
      }
      ts.forEachChild(n, scan);
    };
    scan(m);
  }
  return cls;
}

/** Interface → name + fields (property signatures) + methods (method signatures). */
function extractInterface(node, sf, line) {
  const fields = [];
  const methods = [];
  for (const m of node.members) {
    if (ts.isPropertySignature(m) && m.name) {
      fields.push({ vis: '+', name: m.name.getText(sf), type: typeText(m.type, sf) });
    } else if (ts.isMethodSignature(m) && m.name) {
      methods.push({ vis: '+', name: m.name.getText(sf), params: paramList(m.parameters, sf), ret: typeText(m.type, sf) });
    }
  }
  return { name: node.name.getText(sf), line: line(node), fields, methods, note: jsdocNote(node) };
}

// --- graph assembly ------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.root) ROOT = path.resolve(args.root);
  const projects = discoverProjects();
  const aliases = loadImportAliases();

  const libs = projects.map((p) => ({
    id: 'lib:' + p.name,
    name: p.name,
    domain: tagValue(p.tags, 'domain:') ?? tagValue(p.tags, 'scope:') ?? 'workspace',
    scope: tagValue(p.tags, 'scope:'),
    type: p.projectType === 'application' ? 'app' : (tagValue(p.tags, 'type:') ?? '?'),
    path: p.root,
  }));
  const libBySourceRoot = projects.map((p, i) => [p.sourceRoot, libs[i]]);
  const libOfFile = (rel) => libBySourceRoot.find(([sr]) => rel.startsWith(sr))?.[1] ?? null;
  const libOfImport = (spec) => {
    const hit = aliases.find(([prefix]) => spec === prefix || spec.startsWith(prefix + '/'));
    return hit ? libOfFile(hit[1]) : null;
  };

  const symbols = new Map(); // id → symbol node
  const edges = [];
  const addSymbol = (s) => { if (!symbols.has(s.id)) symbols.set(s.id, s); return symbols.get(s.id); };
  const addEdge = (from, to, kind, extra = {}) => edges.push({ from, to, kind, ...extra });

  const classIndex = new Map(); // class name → symbol id (for inject() resolution)
  const parsed = []; // [{lib, rel, facts}]

  for (const [sourceRoot, lib] of libBySourceRoot) {
    for (const file of listSourceFiles(sourceRoot)) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      parsed.push({ lib, rel, facts: extractFile(file, rel) });
    }
  }

  // Pass 1: declare symbols (actions, classes) and library dependency edges.
  const libDeps = new Set();
  for (const { lib, rel, facts } of parsed) {
    for (const spec of facts.imports) {
      const target = libOfImport(spec);
      if (target && target.id !== lib.id) libDeps.add(lib.id + ' ' + target.id);
    }
    for (const a of facts.actions) {
      addSymbol({ id: 'action:' + a.id, kind: 'action', name: a.id, type: a.type, library: lib.id, file: rel, line: a.line });
    }
    for (const c of facts.classes) {
      let kind = 'class';
      if (c.stateName) kind = 'state';
      else if (c.effects.length > 0 || c.extendsClause === 'NgxsEffectsService') kind = 'effects';
      else if (c.isComponent) kind = 'component';
      else if (/ApiService$/.test(c.name) || c.httpCalls.length > 0) kind = 'api';
      else if (/StateService$/.test(c.name)) kind = 'facade';
      else if (c.isInjectable) kind = 'service';
      const id = lib.id.replace(/^lib:/, 'sym:') + '/' + c.name;
      // Effect classes carry per-effect detail for the state-module tile.
      const short = (t) => t.split('.').slice(-2).join('.');
      const effectMethods =
        kind === 'effects'
          ? c.effects.map((e) => ({
              name: e.method,
              operator: e.operator,
              triggers: e.triggers.map(short),
              emits: c.dispatches.filter((d) => d.method === e.method).map((d) => short(d.action)),
            }))
          : undefined;
      addSymbol({
        id, kind, name: c.name, stateName: c.stateName ?? undefined, library: lib.id, file: rel, line: c.line,
        fields: c.fields, methods: c.methods, note: c.note ?? undefined, effectMethods,
      });
      classIndex.set(c.name, id);
    }
    for (const it of facts.interfaces ?? []) {
      const id = lib.id.replace(/^lib:/, 'sym:') + '/' + it.name;
      addSymbol({
        id, kind: 'interface', name: it.name, library: lib.id, file: rel, line: it.line,
        fields: it.fields, methods: it.methods, note: it.note ?? undefined,
      });
    }
  }
  for (const dep of libDeps) {
    const [from, to] = dep.split(' ');
    addEdge(from, to, 'lib_dep');
  }

  // Selector definitions: namespace consts referenced by select* calls.
  const selectorDefs = new Map(); // path text → {lib, file, line}
  for (const { lib, rel, facts } of parsed) {
    for (const nc of facts.namespaceConsts) selectorDefs.set(nc.id, { lib, file: rel, line: nc.line });
  }

  // Pass 2: semantic edges.
  const actionId = (text) => (symbols.has('action:' + text) ? 'action:' + text : null);
  for (const { lib, rel, facts } of parsed) {
    for (const c of facts.classes) {
      const symId = classIndex.get(c.name);

      for (const h of c.actionHandlers) {
        const a = actionId(h.action);
        if (a) addEdge(a, symId, 'handles', { method: h.method });
      }
      for (const ef of c.effects) {
        for (const t of ef.triggers) {
          const a = actionId(t);
          if (a) addEdge(a, symId, 'triggers', { method: ef.method, operator: ef.operator });
        }
      }
      for (const d of c.dispatches) {
        const a = actionId(d.action);
        const kind = c.effects.some((e) => e.method === d.method) ? 'emits' : 'dispatches';
        if (a) addEdge(symId, a, kind, { method: d.method });
        else addEdge(symId, 'action:?' + d.action, kind, { method: d.method, unresolved: true });
      }
      for (const s of c.selects) {
        const def = selectorDefs.get(s.selector);
        const selId = 'selector:' + s.selector;
        addSymbol({
          id: selId, kind: 'selector', name: s.selector,
          library: def?.lib.id ?? lib.id, file: def?.file ?? rel, line: def?.line,
        });
        addEdge(symId, selId, 'selects', { member: s.member });
      }
      for (const call of c.apiCalls) {
        const targetId = classIndex.get(call.type);
        if (targetId) {
          const kind = symbols.get(targetId)?.kind === 'api' ? 'calls_api' : 'uses';
          addEdge(symId, targetId, kind, { method: call.method, fromMethod: call.fromMethod });
        }
      }
      for (const injectedType of Object.values(c.injected)) {
        const targetId = classIndex.get(injectedType);
        if (targetId && targetId !== symId && !edges.some((e) => e.from === symId && e.to === targetId)) {
          addEdge(symId, targetId, 'uses');
        }
      }
      for (const h of c.httpCalls) {
        const epId = 'http:' + h.verb + ' ' + h.url;
        addSymbol({ id: epId, kind: 'endpoint', name: h.verb + ' ' + h.url, library: null });
        addEdge(symId, epId, 'http', { fromMethod: h.fromMethod });
      }
    }
  }

  const domains = [...new Set(libs.map((l) => l.domain))].map((d) => ({ id: 'domain:' + d, name: d }));
  const graph = {
    schema_version: 1,
    generated_by: 'tools/arch-graph/extract.js',
    domains,
    libraries: libs,
    symbols: [...symbols.values()],
    edges,
  };

  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(graph, null, args.pretty ? 2 : 0), 'utf-8');

  const byKind = {};
  for (const s of symbols.values()) byKind[s.kind] = (byKind[s.kind] || 0) + 1;
  const edgeKinds = {};
  for (const e of edges) edgeKinds[e.kind] = (edgeKinds[e.kind] || 0) + 1;
  console.log(`✓ ${domains.length} domains, ${libs.length} libraries, ${symbols.size} symbols, ${edges.length} edges → ${path.resolve(args.out)}`);
  console.log('  symbols:', JSON.stringify(byKind));
  console.log('  edges:  ', JSON.stringify(edgeKinds));
  const unresolved = edges.filter((e) => e.unresolved);
  if (unresolved.length) {
    console.log(`  ⚠ unresolved action references: ${unresolved.length}`);
    for (const e of unresolved.slice(0, 10)) console.log(`    ${e.from} → ${e.to.slice('action:?'.length)}`);
  }
}

main();
