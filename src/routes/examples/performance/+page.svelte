<script lang="ts">
  import { Tree } from '$lib/index.js';
  import '$lib/styles.scss';
  import { enablePerfLogging, disablePerfLogging, isPerfLoggingEnabled } from '$lib/perf-logger.js';

  // Load config from localStorage
  const STORAGE_KEY = 'svelte-treeview-perf-config';
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  }
  const savedConfig = loadConfig();

  // Rendering mode: 'recursive' | 'flat' | 'virtual'
  type RenderMode = 'recursive' | 'flat' | 'virtual';
  let renderMode = $state<RenderMode>(savedConfig.renderMode ?? 'flat');

  // Derived props from renderMode
  const useFlatRendering = $derived(renderMode === 'flat' || renderMode === 'virtual');
  const virtualScroll = $derived(renderMode === 'virtual');

  // Test configuration with localStorage defaults
  let expandLevel = $state(savedConfig.expandLevel ?? 1);
  let isSorted = $state(savedConfig.isSorted ?? true);
  let progressiveRender = $state(savedConfig.progressiveRender ?? false);
  let initialBatchSize = $state(savedConfig.initialBatchSize ?? 20);
  let maxBatchSize = $state(savedConfig.maxBatchSize ?? 500);
  let indexerBatchSize = $state(savedConfig.indexerBatchSize ?? 25);
  let shouldUseInternalSearchIndex = $state(savedConfig.shouldUseInternalSearchIndex ?? true);
  let virtualContainerHeight = $state(savedConfig.virtualContainerHeight ?? '500px');
  let virtualOverscan = $state(savedConfig.virtualOverscan ?? 5);
  let perfLoggingEnabled = $state(isPerfLoggingEnabled());

  // Data generation config
  let nodeCountTarget = $state(savedConfig.nodeCountTarget ?? 5000);

  // Save config to localStorage when it changes
  $effect(() => {
    const config = {
      renderMode,
      expandLevel,
      isSorted,
      progressiveRender,
      initialBatchSize,
      maxBatchSize,
      indexerBatchSize,
      shouldUseInternalSearchIndex,
      virtualContainerHeight,
      virtualOverscan,
      nodeCountTarget
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  });

  function resetConfig() {
    localStorage.removeItem(STORAGE_KEY);
    renderMode = 'flat';
    expandLevel = 1;
    isSorted = true;
    progressiveRender = false;
    initialBatchSize = 20;
    maxBatchSize = 500;
    indexerBatchSize = 25;
    shouldUseInternalSearchIndex = true;
    virtualContainerHeight = '500px';
    virtualOverscan = 5;
    nodeCountTarget = 5000;
  }

  function togglePerfLogging() {
    if (perfLoggingEnabled) {
      disablePerfLogging();
      perfLoggingEnabled = false;
    } else {
      enablePerfLogging();
      perfLoggingEnabled = true;
    }
  }

  // Synthetic data generator
  const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Legal', 'Support', 'Product', 'Design'];
  const TEAM_PREFIXES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Core', 'Platform', 'Growth', 'Enterprise', 'Mobile', 'Cloud'];
  const TEAM_SUFFIXES = ['Team', 'Squad', 'Group', 'Unit', 'Division'];

  function generateName(level: number, index: number): string {
    if (level === 1) {
      return DEPARTMENTS[index % DEPARTMENTS.length];
    } else if (level === 2) {
      return `${TEAM_PREFIXES[index % TEAM_PREFIXES.length]} ${TEAM_SUFFIXES[index % TEAM_SUFFIXES.length]}`;
    } else {
      return `Member ${index + 1}`;
    }
  }

  function generateTreeData(targetCount: number): any[] {
    const nodes: any[] = [];
    let id = 1;

    // Calculate structure: aim for roughly targetCount nodes
    // Structure: ~10 L1 nodes, ~10 L2 per L1, rest as L3
    const l1Count = Math.min(10, Math.ceil(targetCount / 100));
    const l2PerL1 = Math.min(15, Math.ceil(targetCount / (l1Count * 10)));
    const l3PerL2 = Math.max(1, Math.floor((targetCount - l1Count - l1Count * l2PerL1) / (l1Count * l2PerL1)));

    for (let i = 0; i < l1Count; i++) {
      const l1Path = String(i + 1);
      nodes.push({
        id: id++,
        path: l1Path,
        parentPath: '',
        level: 1,
        name: generateName(1, i),
        hasChildren: true
      });

      for (let j = 0; j < l2PerL1; j++) {
        const l2Path = `${l1Path}.${j + 1}`;
        nodes.push({
          id: id++,
          path: l2Path,
          parentPath: l1Path,
          level: 2,
          name: generateName(2, j),
          hasChildren: l3PerL2 > 0
        });

        for (let k = 0; k < l3PerL2; k++) {
          const l3Path = `${l2Path}.${k + 1}`;
          nodes.push({
            id: id++,
            path: l3Path,
            parentPath: l2Path,
            level: 3,
            name: `${generateName(2, j)} - ${generateName(3, k)}`,
            hasChildren: false
          });

          if (nodes.length >= targetCount) break;
        }
        if (nodes.length >= targetCount) break;
      }
      if (nodes.length >= targetCount) break;
    }

    return nodes;
  }

  // Countries + States data loader (real-world hierarchical data)
  // Data source: https://github.com/dr5hn/countries-states-cities-database
  const COUNTRIES_STATES_URL = 'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries%2Bstates.json';

  interface CountryData {
    name: string;
    states: string[];
  }

  function transformCountriesData(countries: CountryData[]): any[] {
    const nodes: any[] = [];
    let id = 1;

    countries.forEach((country, countryIdx) => {
      const countryPath = String(countryIdx + 1);
      const hasStates = country.states && country.states.length > 0;

      nodes.push({
        id: id++,
        path: countryPath,
        parentPath: '',
        level: 1,
        name: country.name,
        hasChildren: hasStates
      });

      if (hasStates) {
        country.states.forEach((state, stateIdx) => {
          const statePath = `${countryPath}.${stateIdx + 1}`;
          nodes.push({
            id: id++,
            path: statePath,
            parentPath: countryPath,
            level: 2,
            name: state,
            hasChildren: false
          });
        });
      }
    });

    return nodes;
  }

  async function loadCountriesData(): Promise<any[]> {
    const response = await fetch(COUNTRIES_STATES_URL);
    if (!response.ok) throw new Error('Failed to fetch countries data');
    const countries: CountryData[] = await response.json();
    return transformCountriesData(countries);
  }

  // Data
  let treeData = $state.raw<any[]>([]);
  let isLoading = $state(false);

  // Performance metrics
  let metrics = $state({
    generateTime: null as number | null,
    renderStart: null as number | null,
    renderTime: null as number | null,
    nodeCount: 0
  });

  // Tree state
  let treeRef: any;
  let treeKey = $state(0);
  let insertResult = $state<any>(null);

  // Progressive rendering state
  let isRendering = $state(false);
  let renderStats = $state({ pending: 0, processed: 0 });

  // Expand/collapse timing
  let lastExpandTime = $state<number | null>(null);

  function generateTestData() {
    isLoading = true;
    metrics.renderTime = null;
    dataSource = 'synthetic';

    const generateStart = performance.now();
    const data = generateTreeData(nodeCountTarget);
    metrics.generateTime = performance.now() - generateStart;
    metrics.nodeCount = data.length;

    // Trigger render
    metrics.renderStart = performance.now();
    treeData = data;
    treeKey++;

    isLoading = false;
  }

  async function loadCountriesTestData() {
    isLoading = true;
    metrics.renderTime = null;
    dataSource = 'countries';

    try {
      const generateStart = performance.now();
      const data = await loadCountriesData();
      metrics.generateTime = performance.now() - generateStart;
      metrics.nodeCount = data.length;

      // Trigger render
      metrics.renderStart = performance.now();
      treeData = data;
      treeKey++;
    } catch (e) {
      console.error('Failed to load countries data:', e);
      alert('Failed to load countries data. Check console for details.');
    }

    isLoading = false;
  }

  // Track which data source was used
  let dataSource = $state<'synthetic' | 'countries' | null>(null);

  function clearData() {
    treeData = [];
    metrics = {
      generateTime: null,
      renderStart: null,
      renderTime: null,
      nodeCount: 0
    };
    insertResult = null;
    lastExpandTime = null;
    clearSearch();
    dataSource = null;
  }

  function redraw() {
    metrics.renderStart = performance.now();
    metrics.renderTime = null;
    treeKey++;
  }

  function sortCallback(items: any[]) {
    if (!isSorted) return items;
    return [...items].sort((a, b) => {
      const aVal = a.data?.name ?? '';
      const bVal = b.data?.name ?? '';
      return aVal.localeCompare(bVal);
    });
  }

  function timedExpandAll() {
    const start = performance.now();
    treeRef?.expandAll();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lastExpandTime = performance.now() - start;
      });
    });
  }

  function timedCollapseAll() {
    const start = performance.now();
    treeRef?.collapseAll();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lastExpandTime = performance.now() - start;
      });
    });
  }

  // Expand just one node - finds a collapsed node with children
  function timedExpandOneNode() {
    // With expandLevel=1, L2 nodes are collapsed. Find one to expand.
    // First try L2, then L1
    let nodeToExpand = treeData.find(n => n.level === 2 && n.hasChildren);
    if (!nodeToExpand) {
      nodeToExpand = treeData.find(n => n.level === 1 && n.hasChildren);
    }
    if (!nodeToExpand) {
      console.log('[Performance Test] No expandable node found');
      return;
    }

    console.log(`[Performance Test] Expanding node: ${nodeToExpand.path} (level ${nodeToExpand.level})`);
    const start = performance.now();
    treeRef?.expandNodes(nodeToExpand.path);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lastExpandTime = performance.now() - start;
        console.log(`[Performance Test] Expand one node (${nodeToExpand.path}): ${lastExpandTime.toFixed(2)}ms`);
      });
    });
  }

  // Collapse just one node - finds an expanded node
  function timedCollapseOneNode() {
    // With expandLevel=1, L1 nodes are expanded. Collapse the first one.
    const nodeToCollapse = treeData.find(n => n.level === 1 && n.hasChildren);
    if (!nodeToCollapse) {
      console.log('[Performance Test] No collapsible node found');
      return;
    }

    console.log(`[Performance Test] Collapsing node: ${nodeToCollapse.path} (level ${nodeToCollapse.level})`);
    const start = performance.now();
    treeRef?.collapseNodes(nodeToCollapse.path);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        lastExpandTime = performance.now() - start;
        console.log(`[Performance Test] Collapse one node (${nodeToCollapse.path}): ${lastExpandTime.toFixed(2)}ms`);
      });
    });
  }

  // Search/filter
  let searchText = $state('');
  let lastSearchTime = $state<number | null>(null);

  // Search mode: 'filter' filters the tree, 'search' navigates between matches
  type SearchMode = 'filter' | 'search';
  let searchMode = $state<SearchMode>('filter');
  let searchInputValue = $state('');
  let searchResults = $state<any[]>([]);
  let currentSearchIdx = $state(-1);

  function executeSearch() {
    if (!searchInputValue.trim()) {
      searchResults = [];
      currentSearchIdx = -1;
      lastSearchTime = null;
      return;
    }
    const start = performance.now();
    const results = treeRef?.searchNodes(searchInputValue.trim()) ?? [];
    searchResults = results;
    lastSearchTime = performance.now() - start;
    if (results.length > 0) {
      currentSearchIdx = 0;
      navigateToResult(0);
    } else {
      currentSearchIdx = -1;
    }
  }

  function navigateToResult(idx: number) {
    if (searchResults.length === 0) return;
    currentSearchIdx = idx;
    const node = searchResults[idx];
    if (node?.path) {
      treeRef?.scrollToPath(node.path, { expand: true, highlight: true, scrollOptions: { behavior: 'smooth', block: 'center' }, containerScroll: true });
    }
  }

  function searchNext() {
    if (searchResults.length === 0) {
      executeSearch();
      return;
    }
    const next = (currentSearchIdx + 1) % searchResults.length;
    navigateToResult(next);
  }

  function searchPrev() {
    if (searchResults.length === 0) return;
    const prev = (currentSearchIdx - 1 + searchResults.length) % searchResults.length;
    navigateToResult(prev);
  }

  function clearSearch() {
    searchInputValue = '';
    searchText = '';
    searchResults = [];
    currentSearchIdx = -1;
    lastSearchTime = null;
  }

  function onSearchInput() {
    if (searchMode === 'filter') {
      searchText = searchInputValue;
      const start = performance.now();
      // Also collect matching nodes for navigation
      const results = treeRef?.searchNodes(searchInputValue.trim()) ?? [];
      searchResults = results;
      currentSearchIdx = results.length > 0 ? 0 : -1;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          lastSearchTime = performance.now() - start;
        });
      });
    } else {
      // In search mode, clear stale results but don't search until Enter
      searchResults = [];
      currentSearchIdx = -1;
    }
  }

  function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        searchPrev();
      } else {
        searchNext();
      }
    } else if (e.key === 'Escape') {
      clearSearch();
    }
  }

  function toggleSearchMode() {
    clearSearch();
    searchMode = searchMode === 'filter' ? 'search' : 'filter';
  }

  // updateNode test
  let updateNodePath = $state('');
  let lastUpdateTime = $state<number | null>(null);
  let updateCounter = 0;

  function timedUpdateNode() {
    let targetPath = updateNodePath.trim();
    if (!targetPath) {
      // Pick a random node from level 1 or 2
      const candidates = treeData.filter(n => n.level === 1 || n.level === 2);
      if (candidates.length === 0) {
        console.log('[Performance Test] No nodes to update');
        return;
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      targetPath = pick.path;
    }

    updateCounter++;
    const newName = `UPDATED #${updateCounter} (${new Date().toLocaleTimeString()})`;
    console.log(`[Performance Test] Updating node: ${targetPath} → "${newName}"`);

    const start = performance.now();
    const result = treeRef?.updateNode(targetPath, { name: newName });
    Promise.resolve().then(() => {
      const svelteTime = performance.now() - start;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          lastUpdateTime = performance.now() - start;
          console.log(`[Performance Test] updateNode (${targetPath}): svelte=${svelteTime.toFixed(2)}ms, paint=${lastUpdateTime.toFixed(2)}ms, success: ${result?.success}`);
          if (!result?.success) {
            console.warn(`[Performance Test] updateNode failed: ${result?.error}`);
          }
        });
      });
    });
  }

  // Track previous render mode to detect changes
  let prevRenderMode = renderMode;

  // Auto-redraw when rendering mode changes (if data is loaded)
  $effect(() => {
    const currentMode = renderMode;
    if (treeData.length > 0 && currentMode !== prevRenderMode) {
      prevRenderMode = currentMode;
      // Reset metrics and trigger redraw
      metrics.generateTime = null; // Clear generate time since we're just switching modes
      metrics.renderStart = performance.now();
      metrics.renderTime = null;
      lastExpandTime = null;
      treeKey++;
    }
  });

  // Measure render time
  // Capture renderStart at schedule time so async rAF callback uses the correct value.
  // Guard against stale callbacks: only write if renderTime is still null.
  $effect(() => {
    if (treeData.length > 0 && metrics.renderStart && !metrics.renderTime) {
      const capturedStart = metrics.renderStart;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!metrics.renderTime && metrics.renderStart === capturedStart) {
            metrics.renderTime = performance.now() - capturedStart;
          }
        });
      });
    }
  });

  // Log results for easy comparison
  $effect(() => {
    if (metrics.renderTime) {
      console.log(`[Performance Test] Mode: ${renderMode.toUpperCase()}`);
      console.log(`[Performance Test] Nodes: ${metrics.nodeCount}`);
      console.log(`[Performance Test] Expand Level: ${expandLevel}`);
      if (metrics.generateTime !== null) {
        console.log(`[Performance Test] Generate: ${metrics.generateTime.toFixed(2)}ms`);
      }
      console.log(`[Performance Test] Render: ${metrics.renderTime.toFixed(2)}ms`);
      console.log('---');
    }
  });
</script>

<svelte:head>
  <title>Performance Test - Svelte Treeview</title>
  <link rel="stylesheet" href="/examples-shared.css" />
</svelte:head>

<div class="container">
  <header>
    <a href="/" class="back-link">&larr; Back to Examples</a>
    <h1>Performance Test</h1>
    <p class="subtitle">Compare recursive vs flat rendering with large datasets</p>
  </header>

  <div class="card">
    <h2>Rendering Mode</h2>
    <div class="mode-toggle">
      <label class="toggle-option" class:active={renderMode === 'recursive'}>
        <input type="radio" bind:group={renderMode} value="recursive" />
        <span class="toggle-label">Recursive</span>
        <span class="toggle-desc">Traditional nested rendering with {'{#key}'} block</span>
      </label>
      <label class="toggle-option" class:active={renderMode === 'flat'}>
        <input type="radio" bind:group={renderMode} value="flat" />
        <span class="toggle-label">Flat</span>
        <span class="toggle-desc">Centralized {'{#each}'} loop, per-node signals</span>
      </label>
      <label class="toggle-option" class:active={renderMode === 'virtual'}>
        <input type="radio" bind:group={renderMode} value="virtual" />
        <span class="toggle-label">Virtual Scroll</span>
        <span class="toggle-desc">Flat + only renders visible nodes (~50 in DOM)</span>
      </label>
    </div>

    <!-- Mode-specific options -->
    {#if renderMode === 'virtual'}
      <div class="mode-options">
        <label>
          Container Height:
          <input type="text" bind:value={virtualContainerHeight} style="width: 80px" />
        </label>
        <label title="Extra rows rendered above and below the viewport to prevent flicker during fast scrolling">
          Overscan:
          <input type="number" bind:value={virtualOverscan} min="0" max="50" step="1" />
        </label>
      </div>
    {/if}
    {#if renderMode !== 'virtual'}
      <div class="mode-options">
        <label>
          <input type="checkbox" bind:checked={progressiveRender} />
          Progressive Render
        </label>
        {#if progressiveRender}
          <label>
            Initial Batch:
            <input type="number" bind:value={initialBatchSize} min="5" max="200" step="5" />
          </label>
          <label>
            Max Batch:
            <input type="number" bind:value={maxBatchSize} min="100" max="2000" step="100" />
          </label>
        {/if}
      </div>
    {/if}
  </div>

  <div class="card">
    <h2>Configuration</h2>
    <div class="controls">
      <label>
        Node Count:
        <input type="number" bind:value={nodeCountTarget} min="100" max="50000" step="1000" />
      </label>
      <label>
        Expand Level:
        <input type="number" bind:value={expandLevel} min="0" max="10" />
      </label>
      <label>
        <input type="checkbox" bind:checked={isSorted} />
        Sort by name
      </label>
      <label>
        <input type="checkbox" bind:checked={shouldUseInternalSearchIndex} />
        Search Index
      </label>
      {#if shouldUseInternalSearchIndex}
        <label>
          Index Batch:
          <input type="number" bind:value={indexerBatchSize} min="5" max="500" step="5" />
        </label>
      {/if}
    </div>
    <div class="controls">
      <button class="btn" onclick={generateTestData} disabled={isLoading}>
        {isLoading ? 'Loading...' : `Generate ${nodeCountTarget.toLocaleString()} Nodes`}
      </button>
      <button class="btn" onclick={loadCountriesTestData} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Load Countries + States (~5K nodes)'}
      </button>
      <button class="btn secondary" onclick={redraw} disabled={treeData.length === 0}>Redraw</button>
      <button class="btn secondary" onclick={clearData} disabled={treeData.length === 0}>Clear</button>
      <button class="btn secondary" onclick={resetConfig}>Reset Config</button>
      <button class="btn" class:active={perfLoggingEnabled} onclick={togglePerfLogging}>
        {perfLoggingEnabled ? 'Perf Logging ON' : 'Perf Logging OFF'}
      </button>
    </div>
  </div>

  <div class="card">
    <h2>Performance Metrics</h2>
    <div class="metrics">
      <div class="metric">
        <span class="value">{metrics.nodeCount.toLocaleString()}</span>
        <span class="label">Nodes</span>
      </div>
      <div class="metric">
        <span class="value">{metrics.generateTime?.toFixed(2) ?? '-'} ms</span>
        <span class="label">Generate</span>
      </div>
      <div class="metric">
        <span class="value">{metrics.renderTime?.toFixed(2) ?? 'measuring...'} ms</span>
        <span class="label">Render</span>
      </div>
      <div class="metric total">
        <span class="value">
          {metrics.renderTime
            ? ((metrics.generateTime || 0) + metrics.renderTime).toFixed(2)
            : '-'} ms
        </span>
        <span class="label">Total</span>
      </div>
      {#if lastExpandTime !== null}
        <div class="metric expand-time">
          <span class="value">{lastExpandTime.toFixed(2)} ms</span>
          <span class="label">Expand/Collapse</span>
        </div>
      {/if}
      {#if lastUpdateTime !== null}
        <div class="metric expand-time">
          <span class="value">{lastUpdateTime.toFixed(2)} ms</span>
          <span class="label">Update Node</span>
        </div>
      {/if}
      {#if lastSearchTime !== null}
        <div class="metric search-time">
          <span class="value">{lastSearchTime.toFixed(2)} ms</span>
          <span class="label">Search/Filter</span>
        </div>
      {/if}
      {#if progressiveRender}
        <div class="metric" class:rendering={isRendering}>
          <span class="value">
            {#if isRendering}
              {renderStats.pending} pending
            {:else}
              Done
            {/if}
          </span>
          <span class="label">Progressive</span>
        </div>
      {/if}
    </div>

    {#if insertResult?.failedNodes?.length > 0}
      <p class="warning">
        {insertResult.failedNodes.length} nodes failed to insert
      </p>
    {/if}
  </div>

  {#if treeData.length > 0}
    <div class="card">
      <h2>
        {dataSource === 'countries' ? 'Countries + States' : 'Synthetic Data'}
        ({metrics.nodeCount.toLocaleString()} nodes) - {renderMode === 'virtual' ? 'Virtual Scroll' : renderMode === 'flat' ? 'Flat Mode' : 'Recursive Mode'}
      </h2>
      <div class="tree-controls">
        <button class="btn" onclick={timedExpandOneNode}>Expand One (timed)</button>
        <button class="btn" onclick={timedCollapseOneNode}>Collapse One (timed)</button>
        <span class="control-divider">|</span>
        <button class="btn secondary" onclick={timedExpandAll}>Expand All (timed)</button>
        <button class="btn secondary" onclick={timedCollapseAll}>Collapse All (timed)</button>
        <button class="btn secondary" onclick={() => treeRef?.expandAll()}>Expand All</button>
        <button class="btn secondary" onclick={() => treeRef?.collapseAll()}>Collapse All</button>
      </div>
      <div class="tree-controls">
        <input type="text" bind:value={updateNodePath} placeholder="Node path (empty = random)" class="path-input" />
        <button class="btn" onclick={timedUpdateNode}>Update Node (timed)</button>
        {#if lastUpdateTime !== null}
          <span class="update-time">{lastUpdateTime.toFixed(2)} ms</span>
        {/if}
      </div>
      <div class="search-bar">
        <button
          class="search-mode-btn"
          title={searchMode === 'filter' ? 'Filter mode — switch to Search' : 'Search mode — switch to Filter'}
          aria-label="Toggle search mode"
          onclick={toggleSearchMode}
        >
          {#if searchMode === 'filter'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          {/if}
        </button>
        <input
          type="text"
          bind:value={searchInputValue}
          placeholder={searchMode === 'filter' ? 'Filter nodes...' : 'Search nodes... (Enter to find)'}
          class="search-input"
          oninput={onSearchInput}
          onkeydown={onSearchKeydown}
        />
        {#if searchResults.length > 0}
          <span class="search-counter">{currentSearchIdx + 1}/{searchResults.length}</span>
          <button class="search-nav-btn" title="Previous (Shift+Enter)" aria-label="Previous result" onclick={searchPrev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="search-nav-btn" title="Next (Enter)" aria-label="Next result" onclick={searchNext}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        {:else if searchInputValue && lastSearchTime !== null}
          <span class="search-counter no-results">0 results</span>
        {/if}
        {#if searchInputValue}
          <button class="search-nav-btn" title="Clear" aria-label="Clear search" onclick={clearSearch}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        {/if}
        {#if lastSearchTime !== null}
          <span class="update-time">{lastSearchTime.toFixed(2)} ms</span>
        {/if}
      </div>
      <div class="tree-container" class:tree-container-tall={!virtualScroll}>
        {#key treeKey}
          <Tree
            bind:this={treeRef}
            data={treeData}
            idMember="id"
            pathMember="path"
            parentPathMember="parentPath"
            levelMember="level"
            hasChildrenMember="hasChildren"
            displayValueMember="name"
            {sortCallback}
            {isSorted}
            {expandLevel}
            {progressiveRender}
            {initialBatchSize}
            {maxBatchSize}
            {indexerBatchSize}
            {shouldUseInternalSearchIndex}
            searchValueMember="name"
            bind:searchText
            {useFlatRendering}
            {virtualScroll}
            {virtualContainerHeight}
            {virtualOverscan}
            bind:insertResult
            bind:isRendering
            onRenderStart={() => {
              console.log('[Render] Started');
              renderStats = { pending: 0, processed: 0 };
            }}
            onRenderProgress={(stats) => {
              renderStats = stats;
            }}
            onRenderComplete={(stats) => {
              console.log('[Render] Complete:', stats);
              renderStats = stats;
            }}
          >
            {#snippet nodeTemplate(node)}
              <span class="node-label"><span class="node-path">[{node.path}]</span> {node.data?.name ?? node.path}</span>
            {/snippet}
          </Tree>
        {/key}
      </div>
    </div>
  {/if}

  <div class="card">
    <h2>What to Test</h2>
    <div class="description">
      <ol>
        <li><strong>Initial render:</strong> Generate data with different node counts and expand levels. Compare render times between modes.</li>
        <li><strong>Expand/Collapse ONE node:</strong> The key test! Use "Expand One" and "Collapse One" buttons. This is the typical user interaction - expanding a single node.</li>
        <li><strong>Expand/Collapse ALL:</strong> Bulk operations - these may be similar between modes since both need to render thousands of nodes.</li>
        <li><strong>Perf Logging:</strong> Enable to see detailed timing in the console.</li>
      </ol>
    </div>

    <div class="note">
      <div class="note-title">Expected Results</div>
      <ul>
        <li><strong>Expand One - Recursive:</strong> Destroys and recreates ALL visible nodes just to add ~10 children</li>
        <li><strong>Expand One - Flat:</strong> Only adds the new children (~10 nodes) - should be much faster</li>
        <li>Expand All may be similar because both modes create thousands of new nodes</li>
      </ul>
    </div>
  </div>

  <footer>
    <p><a href="/">&larr; Back to Examples</a></p>
  </footer>
</div>

<style>
  .mode-toggle {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .toggle-option {
    flex: 1;
    padding: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-option:hover {
    border-color: #667eea;
  }

  .toggle-option.active {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  }

  .toggle-option input {
    display: none;
  }

  .toggle-label {
    display: block;
    font-size: 1.25rem;
    font-weight: 600;
    color: #2d3748;
    margin-bottom: 0.25rem;
  }

  .toggle-desc {
    display: block;
    font-size: 0.875rem;
    color: #718096;
  }

  .mode-options {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 0.75rem 1rem;
    margin-top: 0.75rem;
    background: #f7fafc;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .metrics {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .metric {
    background: #f7fafc;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    text-align: center;
    min-width: 120px;
  }

  .metric.total {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .metric.expand-time {
    background: #48bb78;
    color: white;
  }

  .metric.rendering {
    background: #f6e05e;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .metric .value {
    display: block;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .metric .label {
    display: block;
    font-size: 0.8rem;
    opacity: 0.8;
    margin-top: 0.25rem;
  }

  .warning {
    color: #c53030;
    margin-top: 1rem;
  }

  .tree-controls {
    margin-bottom: 1rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .control-divider {
    color: #cbd5e0;
    margin: 0 0.25rem;
  }

  .btn.active {
    background: #48bb78;
  }

  .path-input {
    padding: 0.4rem 0.6rem;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    font-size: 0.875rem;
    width: 220px;
    font-family: monospace;
  }

  .metric.search-time {
    background: #667eea;
    color: white;
  }

  .update-time {
    font-weight: 600;
    color: #48bb78;
  }

  .node-path {
    color: #a0aec0;
    font-size: 0.8em;
    font-family: monospace;
  }

  ol {
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }

  ol li {
    margin-bottom: 0.5rem;
  }
</style>
