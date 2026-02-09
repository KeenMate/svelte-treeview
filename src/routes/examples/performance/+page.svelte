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

  // Test configuration with localStorage defaults
  let expandLevel = $state(savedConfig.expandLevel ?? 1);
  let isSorted = $state(savedConfig.isSorted ?? true);
  let progressiveRender = $state(savedConfig.progressiveRender ?? false);
  let renderBatchSize = $state(savedConfig.renderBatchSize ?? 50);
  let indexerBatchSize = $state(savedConfig.indexerBatchSize ?? 25);
  let shouldUseInternalSearchIndex = $state(savedConfig.shouldUseInternalSearchIndex ?? true);
  let useFlatRendering = $state(savedConfig.useFlatRendering ?? false);
  let perfLoggingEnabled = $state(isPerfLoggingEnabled());

  // Data generation config
  let nodeCountTarget = $state(savedConfig.nodeCountTarget ?? 5000);

  // Save config to localStorage when it changes
  $effect(() => {
    const config = {
      expandLevel,
      isSorted,
      progressiveRender,
      renderBatchSize,
      indexerBatchSize,
      shouldUseInternalSearchIndex,
      useFlatRendering,
      nodeCountTarget
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  });

  function resetConfig() {
    localStorage.removeItem(STORAGE_KEY);
    expandLevel = 1;
    isSorted = true;
    progressiveRender = false;
    renderBatchSize = 50;
    indexerBatchSize = 25;
    shouldUseInternalSearchIndex = true;
    useFlatRendering = false;
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

  // Measure render time
  $effect(() => {
    if (treeData.length > 0 && metrics.renderStart && !metrics.renderTime) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          metrics.renderTime = performance.now() - metrics.renderStart!;
        });
      });
    }
  });

  // Log results for easy comparison
  $effect(() => {
    if (metrics.renderTime) {
      console.log(`[Performance Test] Flat Rendering: ${useFlatRendering}`);
      console.log(`[Performance Test] Nodes: ${metrics.nodeCount}`);
      console.log(`[Performance Test] Expand Level: ${expandLevel}`);
      console.log(`[Performance Test] Generate: ${metrics.generateTime?.toFixed(2)}ms`);
      console.log(`[Performance Test] Render: ${metrics.renderTime?.toFixed(2)}ms`);
      console.log(`[Performance Test] Total: ${((metrics.generateTime || 0) + metrics.renderTime).toFixed(2)}ms`);
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
      <label class="toggle-option" class:active={!useFlatRendering}>
        <input type="radio" bind:group={useFlatRendering} value={false} />
        <span class="toggle-label">Recursive</span>
        <span class="toggle-desc">Traditional nested rendering with {'{#key}'} block</span>
      </label>
      <label class="toggle-option" class:active={useFlatRendering}>
        <input type="radio" bind:group={useFlatRendering} value={true} />
        <span class="toggle-label">Flat (New!)</span>
        <span class="toggle-desc">Centralized rendering, efficient expand/collapse</span>
      </label>
    </div>
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
      {#if !useFlatRendering}
        <label>
          <input type="checkbox" bind:checked={progressiveRender} />
          Progressive Render
        </label>
        {#if progressiveRender}
          <label>
            Batch Size:
            <input type="number" bind:value={renderBatchSize} min="10" max="500" step="10" />
          </label>
        {/if}
      {/if}
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
        {isLoading ? 'Generating...' : `Generate ${nodeCountTarget.toLocaleString()} Nodes`}
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
      {#if progressiveRender && !useFlatRendering}
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
      <h2>Tree ({metrics.nodeCount.toLocaleString()} nodes) - {useFlatRendering ? 'Flat Mode' : 'Recursive Mode'}</h2>
      <div class="tree-controls">
        <button class="btn secondary" onclick={timedExpandAll}>Expand All (timed)</button>
        <button class="btn secondary" onclick={timedCollapseAll}>Collapse All (timed)</button>
        <button class="btn secondary" onclick={() => treeRef?.expandAll()}>Expand All</button>
        <button class="btn secondary" onclick={() => treeRef?.collapseAll()}>Collapse All</button>
      </div>
      <div class="tree-container tree-container-tall">
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
            progressiveRender={useFlatRendering ? false : progressiveRender}
            {renderBatchSize}
            {indexerBatchSize}
            {shouldUseInternalSearchIndex}
            {useFlatRendering}
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
              <span>{node.data?.name ?? node.path}</span>
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
        <li><strong>Expand/Collapse:</strong> Click a node to expand/collapse. In recursive mode, this destroys and recreates all DOM nodes. In flat mode, only affected nodes are updated.</li>
        <li><strong>Expand All:</strong> Use the timed buttons to measure how long expand/collapse operations take.</li>
        <li><strong>Perf Logging:</strong> Enable to see detailed timing in the console.</li>
      </ol>
    </div>

    <div class="note">
      <div class="note-title">Expected Results</div>
      <ul>
        <li><strong>Recursive mode:</strong> Expand/collapse triggers full re-render (slow with many nodes)</li>
        <li><strong>Flat mode:</strong> Expand/collapse only updates the changed nodes (fast)</li>
        <li>Initial render may be similar, but subsequent operations should be much faster in flat mode</li>
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
  }

  .btn.active {
    background: #48bb78;
  }

  ol {
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }

  ol li {
    margin-bottom: 0.5rem;
  }
</style>
