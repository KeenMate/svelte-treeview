// Main exports for the @keenmate/svelte-treeview library

// Main components
export { default as Tree } from './lib/Tree.svelte';
export { default as Node } from './lib/Node.svelte';

// LTree Trie core functionality
export { type LTreeTrieNode } from './lib/ltree/ltree-trie-node.svelte';
export { createLTreeTrie } from './lib/ltree/ltree-trie.svelte';
export * from './lib/ltree/types';

// Utility functions and helpers
export * from './lib/helpers/ltree-helpers';
export * from './lib/helpers/string-helpers';

// Demo data generators (optional, for testing/examples)
export {
  createSampleFilesTree,
  createDepartmentTree,
  createPerformanceTestTree,
  createAnimalsData,
  createZooZonesData,
  type DepartmentData,
  type AnimalData,
  type ZooZoneData
} from './lib/treeData';

// FlexSearch integration
export * from './lib/ltree/flex';

// Demo utilities (optional) - Commented out for now due to API mismatch
// export { demonstrateLTreeTrie, performanceTest } from './lib/ltree/ltree-demo';