#!/usr/bin/env node
// One-shot rename:
//   --ltree-*   → --stv-*       (CSS variables, mechanical)
//   .ltree-*    → .stv__*       (CSS classes, BEM per map below)
//   @keyframes ltree-spin → stv-spin
//
// File paths (`./ltree-node.svelte`, `./ltree-helpers.js`) are excluded
// via a negative lookbehind that rejects `/` before `ltree-`.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.svelte-kit' || name === 'dist' || name === 'build' || name === 'test-results' || name === '.claude' || name === '.git') continue;
      walk(abs, exts, out);
    } else if (exts.some(e => name.endsWith(e))) {
      out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

// BEM class rename map. Longer keys MUST be processed before shorter
// keys with the same prefix (e.g. ltree-node-content before ltree-node)
// so the longer match wins. We sort by key length DESC below.
const CLASS_RENAMES = {
  // 2-underscore drop (only one in the codebase)
  'ltree-checkbox__box': 'stv__checkbox-box',

  // Elements
  'ltree-container': 'stv__container',
  'ltree-tree': 'stv__tree',
  'ltree-node-row': 'stv__node-row',
  'ltree-node-content': 'stv__node-content',
  'ltree-node-icon': 'stv__node-icon',
  'ltree-node-label': 'stv__node-label',
  'ltree-node-path': 'stv__node-path',
  'ltree-node': 'stv__node',
  'ltree-children': 'stv__children',
  'ltree-checkbox': 'stv__checkbox',
  'ltree-toggle-icon': 'stv__toggle-icon',
  'ltree-empty-state': 'stv__empty-state',
  'ltree-virtual-scroll': 'stv__virtual-scroll',
  'ltree-touch-ghost': 'stv__touch-ghost',
  'ltree-debug-info': 'stv__debug-info',
  'ltree-debug-stats': 'stv__debug-stats',
  'ltree-loading-overlay': 'stv__loading-overlay',
  'ltree-loading-spinner': 'stv__loading-spinner',
  'ltree-loading-more': 'stv__loading-more',
  'ltree-scroll-highlight-arrow': 'stv__scroll-arrow',
  'ltree-drop-placeholder-content': 'stv__drop-placeholder-content',
  'ltree-drop-placeholder': 'stv__drop-placeholder',
  'ltree-root-drop-zone': 'stv__root-drop-zone',
  'ltree-drop-zones': 'stv__drop-zones',
  'ltree-drop-zone': 'stv__drop-zone',
  'ltree-context-menu-divider-label': 'stv__context-menu-divider-label',
  'ltree-context-menu-divider': 'stv__context-menu-divider',
  'ltree-context-menu-shortcut': 'stv__context-menu-shortcut',
  'ltree-context-menu-arrow': 'stv__context-menu-arrow',
  'ltree-context-menu-icon': 'stv__context-menu-icon',
  'ltree-context-menu-label': 'stv__context-menu-label',
  'ltree-context-menu-item-disabled': 'stv__context-menu-item--disabled',
  'ltree-context-menu-has-children': 'stv__context-menu-item--has-children',
  'ltree-context-menu-item': 'stv__context-menu-item',
  'ltree-context-menu': 'stv__context-menu',
  'ltree-context-submenu': 'stv__context-submenu',

  // Modifiers
  'ltree-clickable': 'stv__clickable',                 // utility — applied to toggle-icon AND node-content
  'ltree-draggable': 'stv__node-content--draggable',   // on node-content per Node.svelte
  'ltree-dragged': 'stv__node-content--dragged',       // on node-content
  'ltree-drop-copy': 'stv__node-content--drop-copy',   // on node-content
  'ltree-multi-selected': 'stv__node-content--multi-selected',
  'ltree-flat-mode': 'stv__tree--flat',
  'ltree-drag-over': 'stv__node-content--drag-over',
  'ltree-drop-valid': 'stv__node-content--drop-valid',
  'ltree-drop-invalid': 'stv__node-content--drop-invalid',
  'ltree-glow-before': 'stv__node-content--glow-before',
  'ltree-glow-after': 'stv__node-content--glow-after',
  'ltree-glow-child': 'stv__node-content--glow-child',
  'ltree-dragover-highlight': 'stv__node-content--dragover-highlight',  // applied to node-content per controller
  'ltree-dragover-glow': 'stv__node-content--dragover-glow',
  'ltree-scroll-highlight': 'stv__node-content--scroll-highlight',
  'ltree-selected-bold': 'stv__node-content--highlight-bold',           // applied to node-content per Node.svelte
  'ltree-selected-border': 'stv__node-content--highlight-border',
  'ltree-selected-brackets': 'stv__node-content--highlight-brackets',
  'ltree-selected-highlight': 'stv__node-content--highlight-fill',
  'ltree-drop-before': 'stv__drop-zone--before',
  'ltree-drop-after': 'stv__drop-zone--after',
  'ltree-drop-child': 'stv__drop-zone--child',
  'ltree-drop-zone-active': 'stv__drop-zone--active',
  'ltree-drop-zones-around': 'stv__drop-zones--around',
  'ltree-drop-zones-above': 'stv__drop-zones--above',
  'ltree-drop-zones-below': 'stv__drop-zones--below',
  'ltree-drop-zones-wave2': 'stv__drop-zones--wave2',
  'ltree-drop-zones-wave': 'stv__drop-zones--wave',
  'ltree-icon-collapse-arrow': 'stv__toggle-icon--collapse-arrow',
  'ltree-icon-expand-arrow': 'stv__toggle-icon--expand-arrow',
  'ltree-icon-collapse-minus': 'stv__toggle-icon--collapse-minus',
  'ltree-icon-expand-plus': 'stv__toggle-icon--expand-plus',
  'ltree-icon-collapse-alt': 'stv__toggle-icon--collapse-alt',
  'ltree-icon-expand-alt': 'stv__toggle-icon--expand-alt',
  'ltree-icon-leaf': 'stv__toggle-icon--leaf',
  'ltree-icon-collapse': 'stv__toggle-icon--collapse',
  'ltree-icon-expand': 'stv__toggle-icon--expand',
};

// Sort longest first so we never replace a substring before its containing match.
const sortedClassKeys = Object.keys(CLASS_RENAMES).sort((a, b) => b.length - a.length);

const FILES = [
  ...walk(path.join(root, 'src'), ['.ts', '.svelte', '.css', '.html', '.md']),
  ...walk(path.join(root, 'e2e'), ['.ts']),
];

// File paths to skip (must NOT be renamed even though name contains `ltree-`).
const SKIP = new Set([
  'src/lib/helpers/ltree-helpers.ts',
  'src/lib/helpers/ltree-helpers.test.ts',
  'src/lib/ltree/ltree-node.svelte.ts',
  'src/lib/ltree/ltree-sort.test.ts',
]);

let totalChanges = 0;
const perFile = [];

for (const rel of FILES) {
  if (SKIP.has(rel)) continue;
  const abs = path.join(root, rel);
  const orig = readFileSync(abs, 'utf8');
  let body = orig;

  // Phase 1: CSS variable prefix (mechanical, no edge cases).
  body = body.replace(/--ltree-/g, '--stv-');

  // Phase 2: @keyframes name + animation reference.
  //   `@keyframes ltree-spin {` and `animation: ... ltree-spin ...;`
  // Word boundary on both sides handles both forms.
  body = body.replace(/\bltree-spin\b/g, 'stv-spin');

  // Phase 3: class renames per BEM map. We reject matches preceded by
  //   `/` (file paths) or word chars / `-` (mid-identifier).
  for (const oldName of sortedClassKeys) {
    const newName = CLASS_RENAMES[oldName];
    // Escape regex metas in oldName (none expected, but be safe).
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\w/-])${escaped}(?![\\w-])`, 'g');
    body = body.replace(re, newName);
  }

  if (body !== orig) {
    const changes = countDiff(orig, body);
    totalChanges += changes;
    perFile.push({ rel, changes });
    writeFileSync(abs, body, 'utf8');
  }
}

function countDiff(a, b) {
  // crude: count differing lines
  const la = a.split('\n');
  const lb = b.split('\n');
  let n = 0;
  const max = Math.max(la.length, lb.length);
  for (let i = 0; i < max; i++) if (la[i] !== lb[i]) n++;
  return n;
}

perFile.sort((x, y) => y.changes - x.changes);
for (const { rel, changes } of perFile) {
  console.log(`${changes.toString().padStart(4)} ${rel}`);
}
console.log(`\nTotal: ${totalChanges} changed lines across ${perFile.length} files`);
