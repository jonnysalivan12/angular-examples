import MarkdownIt from 'markdown-it';

// Renderowanie treści dokumentu. Surowy HTML z pliku jest wyłączony (html:
// false), więc treść nie może wstrzyknąć skryptu. Identyfikatory węzłów
// w tekście stają się linkami, a bloki ```mermaid``` są zostawiane do
// narysowania przez mermaid w MarkdownView.

const FRONT_MATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
// Kandydat na ID: UC-001, SPEC-WF-001, ENT-DispositionItem, DDM-001.DOM-Klient, A1.
const CANDIDATE = /[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*(?:\.[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)?/g;

// bodyLine to numer linii pliku (od 1), na której zaczyna się treść po front matter.
export function splitFrontMatter(content) {
  const match = (content || '').match(FRONT_MATTER);
  if (!match) return { yaml: null, body: content || '', bodyLine: 1 };
  // Front matter zajmuje tyle linii, ile znaków nowej linii ma dopasowanie.
  const lines = (match[0].match(/\n/g) || []).length;
  return { yaml: match[1], body: content.slice(match[0].length), bodyLine: lines + 1 };
}

// Bloki z numerem linii pliku: akapit, nagłówek, wiersz tabeli, punkt listy,
// cytat, blok kodu. Podgląd podświetla po nich linię z problemem walidacji.
const SOURCE_BLOCKS = new Set(['paragraph_open', 'heading_open', 'tr_open', 'list_item_open', 'blockquote_open', 'fence', 'code_block', 'hr']);

const slugify = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Komentarze HTML (wskazówki z szablonu) nie są treścią dokumentu.
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

// resolve(token) zwraca klucz węzła albo null. docId pozwala rozpoznać wiersz
// zapisany samym ID (A1 w UC-001). assetBase to adres folderu dokumentu,
// pod którym serwer udostępnia obrazy z treści (/api/file?path=…).
export function createRenderer(resolve, { assetBase = null } = {}) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

  md.core.ruler.push('node_ids', state => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue;
      const children = [];
      let linkDepth = 0;
      for (const token of block.children) {
        if (token.type === 'link_open') linkDepth++;
        if (token.type === 'link_close') linkDepth--;
        if (token.type !== 'text' || linkDepth > 0) { children.push(token); continue; }
        const text = token.content;
        let last = 0;
        for (const match of text.matchAll(CANDIDATE)) {
          const before = text[match.index - 1];
          const after = text[match.index + match[0].length];
          if (before && /[A-Za-z0-9_-]/.test(before)) continue;
          if (after && /[A-Za-z0-9_]/.test(after)) continue;
          const key = resolve(match[0]);
          if (!key) continue;
          if (match.index > last) {
            const plain = new state.Token('text', '', 0);
            plain.content = text.slice(last, match.index);
            children.push(plain);
          }
          const link = new state.Token('node_id', '', 0);
          link.content = match[0];
          link.meta = { key };
          children.push(link);
          last = match.index + match[0].length;
        }
        if (last === 0) { children.push(token); continue; }
        if (last < text.length) {
          const rest = new state.Token('text', '', 0);
          rest.content = text.slice(last);
          children.push(rest);
        }
      }
      block.children = children;
    }
  });

  md.core.ruler.push('source_lines', state => {
    const offset = state.env.bodyLine || 1;
    for (const token of state.tokens) {
      if (!token.map || !SOURCE_BLOCKS.has(token.type)) continue;
      token.attrSet('data-src-start', String(token.map[0] + offset));
      token.attrSet('data-src-end', String(token.map[1] + offset - 1));
    }
  });

  // Nagłówki dostają identyfikator do spisu sekcji.
  md.core.ruler.push('heading_ids', state => {
    const used = new Map();
    state.tokens.forEach((token, index) => {
      if (token.type !== 'heading_open') return;
      const text = state.tokens[index + 1]?.content || '';
      let slug = `s-${slugify(text) || 'sekcja'}`;
      const count = used.get(slug) || 0;
      used.set(slug, count + 1);
      if (count) slug = `${slug}-${count}`;
      token.attrSet('id', slug);
    });
  });

  md.renderer.rules.node_id = (tokens, index) => {
    const { content, meta } = tokens[index];
    return `<a href="#" class="idlink" data-id="${md.utils.escapeHtml(meta.key)}">${md.utils.escapeHtml(content)}</a>`;
  };

  // Szeroka tabela przewija się w swoim kontenerze, a nie razem ze stroną.
  md.renderer.rules.table_open = () => '<div class="md-table"><table>\n';
  md.renderer.rules.table_close = () => '</table></div>\n';

  // Obraz ze ścieżką względną leży obok pliku dokumentu, nie w aplikacji.
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const src = token.attrGet('src') || '';
    if (assetBase && !ABSOLUTE_URL.test(src)) token.attrSet('src', `${assetBase}${src.split('/').map(encodeURIComponent).join('/')}`);
    return defaultImage(tokens, index, options, env, self);
  };

  // Link poza aplikację otwiera się w nowej karcie.
  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (/^https?:/i.test(token.attrGet('href') || '')) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    }
    return defaultLinkOpen(tokens, index, options, env, self);
  };

  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token.info.trim() === 'mermaid') return `<pre class="mermaid-src"${self.renderAttrs(token)}>${md.utils.escapeHtml(token.content)}</pre>`;
    return defaultFence(tokens, index, options, env, self);
  };

  // Komentarz zostaje zastąpiony pustymi liniami, żeby numery linii pliku się nie przesunęły.
  return function render(body, { bodyLine = 1 } = {}) {
    const env = { bodyLine };
    const tokens = md.parse(body.replace(HTML_COMMENT, comment => comment.replace(/[^\n]/g, '')), env);
    const headings = [];
    tokens.forEach((token, index) => {
      if (token.type === 'heading_open' && (token.tag === 'h2' || token.tag === 'h3')) {
        headings.push({ id: token.attrGet('id'), level: Number(token.tag[1]), text: tokens[index + 1]?.content || '' });
      }
    });
    return { html: md.renderer.render(tokens, md.options, env), headings };
  };
}
