<script lang="ts">
	import { tick } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, DropPosition, DropOperation } from '$lib/ltree/types.js';
	import ExampleHeader from '../ExampleHeader.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type ScenarioNode = {
		id: number;
		path: string;
		name: string;
		icon: string;
		sortOrder: number;
	};

	type Scenario = 'A' | 'B' | 'C' | 'D' | 'E';

	// Active scenario tab
	let activeTab = $state<Scenario>('A');

	// Scenario descriptions
	const scenarioDescriptions: Record<Scenario, { title: string; description: string; keyFeature: string }> = {
		A: {
			title: 'Full Redraw + State Preservation',
			description: 'Drag-drop saves to DB, then reloads entire tree from DB. Expanded state is preserved using getExpandedPaths() / setExpandedPaths().',
			keyFeature: 'getExpandedPaths() / setExpandedPaths()'
		},
		B: {
			title: 'Partial Redraw (Recommended)',
			description: 'Same-tree moves are auto-handled by the library using moveNode(). No full rebuild needed - maximum performance.',
			keyFeature: 'Auto-handled moveNode()'
		},
		C: {
			title: 'Individual CRUD Operations',
			description: 'Add, edit, and delete nodes with immediate saves to DB. Each operation is saved individually.',
			keyFeature: 'addNode() / updateNode() / removeNode()'
		},
		D: {
			title: 'Empty Tree + Build One by One',
			description: 'Start with an empty tree, drag nodes from source or add manually. Each node is saved to DB as it\'s created.',
			keyFeature: 'dropPlaceholder + addNode()'
		},
		E: {
			title: 'Batch Create Then Save',
			description: 'Build entire tree structure in memory without saving. Use "Save All" to extract and save everything at once.',
			keyFeature: 'getAllData()'
		}
	};

	// Source tree data (shared across all scenarios)
	const sourceData: ScenarioNode[] = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'Report.pdf', icon: '📄', sortOrder: 10 },
		{ id: 3, path: '1.2', name: 'Presentation.pptx', icon: '📊', sortOrder: 20 },
		{ id: 4, path: '1.3', name: 'Notes', icon: '📁', sortOrder: 30 },
		{ id: 5, path: '1.3.1', name: 'Meeting Notes.txt', icon: '📝', sortOrder: 10 },
		{ id: 6, path: '1.3.2', name: 'Ideas.txt', icon: '📝', sortOrder: 20 },
		{ id: 7, path: '2', name: 'Images', icon: '📁', sortOrder: 20 },
		{ id: 8, path: '2.1', name: 'Photo.jpg', icon: '🖼️', sortOrder: 10 },
		{ id: 9, path: '2.2', name: 'Screenshot.png', icon: '🖼️', sortOrder: 20 },
		{ id: 10, path: '3', name: 'Music', icon: '📁', sortOrder: 30 },
		{ id: 11, path: '3.1', name: 'Song.mp3', icon: '🎵', sortOrder: 10 }
	];

	// Initial target data for scenarios A, B, C (pre-populated)
	function createInitialTargetData(): ScenarioNode[] {
		return [
			{ id: 100, path: '1', name: 'Projects', icon: '📁', sortOrder: 10 },
			{ id: 101, path: '1.1', name: 'Project Alpha', icon: '📁', sortOrder: 10 },
			{ id: 102, path: '1.1.1', name: 'Specs.doc', icon: '📄', sortOrder: 10 },
			{ id: 103, path: '1.1.2', name: 'Design.fig', icon: '🎨', sortOrder: 20 },
			{ id: 104, path: '1.2', name: 'Project Beta', icon: '📁', sortOrder: 20 },
			{ id: 105, path: '1.2.1', name: 'README.md', icon: '📄', sortOrder: 10 },
			{ id: 106, path: '2', name: 'Archive', icon: '📁', sortOrder: 20 },
			{ id: 107, path: '2.1', name: 'Old Files', icon: '📁', sortOrder: 10 },
			{ id: 108, path: '2.1.1', name: 'Legacy.zip', icon: '📦', sortOrder: 10 }
		];
	}

	// Per-scenario state
	let nextIdA = $state(1000);
	let nextIdB = $state(2000);
	let nextIdC = $state(3000);
	let nextIdD = $state(4000);
	let nextIdE = $state(5000);

	let targetDataA = $state<ScenarioNode[]>(createInitialTargetData());
	let targetDataB = $state<ScenarioNode[]>(createInitialTargetData());
	let targetDataC = $state<ScenarioNode[]>(createInitialTargetData());
	let targetDataD = $state<ScenarioNode[]>([]); // Empty for scenario D
	let targetDataE = $state<ScenarioNode[]>([]); // Empty for scenario E

	let mockDatabaseA = $state<ScenarioNode[]>([...createInitialTargetData()]);
	let mockDatabaseB = $state<ScenarioNode[]>([...createInitialTargetData()]);
	let mockDatabaseC = $state<ScenarioNode[]>([...createInitialTargetData()]);
	let mockDatabaseD = $state<ScenarioNode[]>([]);
	let mockDatabaseE = $state<ScenarioNode[]>([]);

	let activityLogA = $state<string[]>([]);
	let activityLogB = $state<string[]>([]);
	let activityLogC = $state<string[]>([]);
	let activityLogD = $state<string[]>([]);
	let activityLogE = $state<string[]>([]);

	let selectedNodeC = $state<LTreeNode<ScenarioNode> | null>(null);
	let editNameC = $state('');
	let unsavedCountE = $state(0);

	// Loading state per scenario
	let isLoadingA = $state(false);
	let isLoadingB = $state(false);
	let isLoadingC = $state(false);
	let isLoadingD = $state(false);
	let isLoadingE = $state(false);

	// Tree refs
	let treeRefA = $state<Tree<ScenarioNode>>(undefined!);
	let treeRefB = $state<Tree<ScenarioNode>>(undefined!);
	let treeRefC = $state<Tree<ScenarioNode>>(undefined!);
	let treeRefD = $state<Tree<ScenarioNode>>(undefined!);
	let treeRefE = $state<Tree<ScenarioNode>>(undefined!);

	// Sort function
	function sortByOrder(items: LTreeNode<ScenarioNode>[]) {
		return [...items].sort((a, b) => {
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	// Logging helpers
	function addLogA(message: string) {
		activityLogA = [...activityLogA.slice(-19), `${new Date().toLocaleTimeString()} - ${message}`];
	}
	function addLogB(message: string) {
		activityLogB = [...activityLogB.slice(-19), `${new Date().toLocaleTimeString()} - ${message}`];
	}
	function addLogC(message: string) {
		activityLogC = [...activityLogC.slice(-19), `${new Date().toLocaleTimeString()} - ${message}`];
	}
	function addLogD(message: string) {
		activityLogD = [...activityLogD.slice(-19), `${new Date().toLocaleTimeString()} - ${message}`];
	}
	function addLogE(message: string) {
		activityLogE = [...activityLogE.slice(-19), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	// Simulated DB operations with random latency (50-450ms)
	async function simulateLatency(): Promise<number> {
		const delay = Math.floor(Math.random() * 400) + 50; // 50-450ms
		await new Promise(r => setTimeout(r, delay));
		return delay;
	}

	// ==================== SCENARIO A: Full Redraw ====================
	// Helper to generate next path segment for a parent
	function getNextPathSegmentA(parentPath: string): string {
		const children = mockDatabaseA.filter(n => {
			if (parentPath === '') {
				// Root level: nodes without dots in path
				return !n.path.includes('.');
			}
			// Children: path starts with parent path + dot, and no further dots
			const prefix = parentPath + '.';
			return n.path.startsWith(prefix) && !n.path.slice(prefix.length).includes('.');
		});
		return String(children.length + 1);
	}

	async function handleDropA(dropNode: LTreeNode<ScenarioNode> | null, draggedNode: LTreeNode<ScenarioNode>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) {
		const isSameTree = draggedNode.treeId === 'tree-a';

		// Step 1: Save expanded state BEFORE any changes
		const expandedPaths = treeRefA.getExpandedPaths();
		addLogA(`Saved ${expandedPaths.length} expanded paths`);

		isLoadingA = true;

		if (isSameTree && operation === 'move') {
			// Same-tree move - update database record
			addLogA(`Moving "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name || 'root'}"`);

			// Simulate saving move operation to DB
			const delay = await simulateLatency();

			// Update the mock database (simulate server updating paths)
			const nodeData = mockDatabaseA.find(n => n.id === draggedNode.data?.id);
			if (nodeData) {
				addLogA(`Saved move to DB (${delay}ms)`);
			}
		} else {
			// Cross-tree - copy node with all descendants to database
			const parentPath = dropNode === null ? '' : (position === 'child' ? dropNode.path : (dropNode.parentPath || ''));
			const pathSegment = getNextPathSegmentA(parentPath);
			const rootPath = parentPath ? `${parentPath}.${pathSegment}` : pathSegment;

			// Calculate sortOrder based on position
			let rootSortOrder = 10;
			if (dropNode && position === 'before') {
				rootSortOrder = (dropNode.data?.sortOrder ?? 10) - 5;
			} else if (dropNode && position === 'after') {
				rootSortOrder = (dropNode.data?.sortOrder ?? 10) + 5;
			} else if (position === 'child') {
				rootSortOrder = 10; // First child
			}

			// Recursively collect node and all descendants
			const nodesToAdd: ScenarioNode[] = [];
			let isRoot = true;

			function collectNodes(node: LTreeNode<ScenarioNode>, newPath: string) {
				nodesToAdd.push({
					...node.data!,
					id: nextIdA++,
					path: newPath,
					sortOrder: isRoot ? rootSortOrder : (node.data?.sortOrder || 10)
				});
				isRoot = false;

				// Process children
				const children = Object.values(node.children || {});
				children.forEach((child, index) => {
					const childPath = `${newPath}.${index + 1}`;
					collectNodes(child, childPath);
				});
			}

			collectNodes(draggedNode, rootPath);

			const delay = await simulateLatency();
			mockDatabaseA = [...mockDatabaseA, ...nodesToAdd];
			addLogA(`Added ${nodesToAdd.length} node(s) at "${rootPath}" with sortOrder=${rootSortOrder} (${position} ${dropNode?.data?.name || 'root'}) (${delay}ms)`);
		}

		// Step 2: Reload FULL tree from database (simulating server round-trip)
		addLogA(`Reloading tree from DB...`);
		const reloadDelay = await simulateLatency();
		targetDataA = [...mockDatabaseA];
		addLogA(`Loaded ${mockDatabaseA.length} records (${reloadDelay}ms)`);

		// Step 3: Restore expanded state
		await tick();
		treeRefA.setExpandedPaths(expandedPaths);
		addLogA(`Restored ${expandedPaths.length} expanded paths`);

		isLoadingA = false;
	}

	async function reloadFromDbA() {
		const expandedPaths = treeRefA.getExpandedPaths();
		addLogA(`Reloading from DB (saving ${expandedPaths.length} expanded paths)...`);

		isLoadingA = true;
		const delay = await simulateLatency();
		targetDataA = [...mockDatabaseA];

		await tick();
		treeRefA.setExpandedPaths(expandedPaths);
		addLogA(`Reload complete (${delay}ms), restored expanded state`);
		isLoadingA = false;
	}

	function resetA() {
		mockDatabaseA = [...createInitialTargetData()];
		targetDataA = [...mockDatabaseA];
		activityLogA = [];
		nextIdA = 1000;
		addLogA('Reset to initial state');
	}

	// ==================== SCENARIO B: Partial Redraw ====================
	async function handleDropB(dropNode: LTreeNode<ScenarioNode> | null, draggedNode: LTreeNode<ScenarioNode>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) {
		const isSameTree = draggedNode.treeId === 'tree-b';

		isLoadingB = true;

		if (isSameTree && operation === 'move') {
			// Library auto-handles the move via moveNode() - no rebuild!
			addLogB(`[AUTO-HANDLED] Moved "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name || 'root'}"`);

			// Just save to DB for persistence (tree already updated)
			const delay = await simulateLatency();
			addLogB(`Saved to DB (${delay}ms) - no tree rebuild needed!`);
		} else {
			// Cross-tree copy
			const parentPath = dropNode === null ? '' : (position === 'child' ? dropNode.path : (dropNode.parentPath || ''));

			// Calculate sortOrder based on position
			let rootSortOrder = 10;
			if (dropNode && position === 'before') {
				rootSortOrder = (dropNode.data?.sortOrder ?? 10) - 5;
			} else if (dropNode && position === 'after') {
				rootSortOrder = (dropNode.data?.sortOrder ?? 10) + 5;
			}

			let isFirst = true;
			const result = treeRefB.copyNodeWithDescendants(
				draggedNode,
				parentPath,
				(data) => {
					const order = isFirst ? rootSortOrder : (data.sortOrder || 10);
					isFirst = false;
					return { ...data, id: nextIdB++, path: '', sortOrder: order };
				}
			);

			if (result.success) {
				addLogB(`Copied ${result.count} node(s) with sortOrder=${rootSortOrder} (${position} ${dropNode?.data?.name || 'root'})`);
				const delay = await simulateLatency();
				addLogB(`Saved to DB (${delay}ms)`);
			}
		}

		isLoadingB = false;
	}

	function resetB() {
		targetDataB = [...createInitialTargetData()];
		mockDatabaseB = [...createInitialTargetData()];
		activityLogB = [];
		nextIdB = 2000;
		addLogB('Reset to initial state');
	}

	// ==================== SCENARIO C: Individual CRUD ====================
	async function handleDropC(dropNode: LTreeNode<ScenarioNode> | null, draggedNode: LTreeNode<ScenarioNode>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) {
		const isSameTree = draggedNode.treeId === 'tree-c';

		isLoadingC = true;

		if (isSameTree && operation === 'move') {
			addLogC(`Moved "${draggedNode.data?.name}"`);
			const delay = await simulateLatency();
			addLogC(`Saved move to DB (${delay}ms)`);
		} else {
			const parentPath = dropNode === null ? '' : (position === 'child' ? dropNode.path : (dropNode.parentPath || ''));

			// Calculate sortOrder based on position
			let sortOrder = 10;
			if (dropNode && position === 'before') {
				sortOrder = (dropNode.data?.sortOrder ?? 10) - 5;
			} else if (dropNode && position === 'after') {
				sortOrder = (dropNode.data?.sortOrder ?? 10) + 5;
			}

			const newNode: ScenarioNode = { ...draggedNode.data!, id: nextIdC++, path: '', sortOrder };

			const result = treeRefC.addNode(parentPath, newNode);
			if (result.success) {
				const delay = await simulateLatency();
				mockDatabaseC = [...mockDatabaseC, result.node!.data!];
				addLogC(`Added "${newNode.name}" with sortOrder=${sortOrder} (${position} ${dropNode?.data?.name || 'root'}) (${delay}ms)`);
			}
		}

		isLoadingC = false;
	}

	async function handleAddC() {
		const parentPath = selectedNodeC?.path || '';
		const newNode: ScenarioNode = {
			id: nextIdC++,
			path: '',
			name: `New Item ${nextIdC}`,
			icon: '📄',
			sortOrder: 10
		};

		isLoadingC = true;
		const result = treeRefC.addNode(parentPath, newNode);
		if (result.success) {
			const delay = await simulateLatency();
			mockDatabaseC = [...mockDatabaseC, result.node!.data!];
			addLogC(`Added "${newNode.name}" under "${parentPath || 'root'}" - saved to DB (${delay}ms)`);
		}
		isLoadingC = false;
	}

	async function handleUpdateC() {
		if (!selectedNodeC || !editNameC.trim()) return;

		isLoadingC = true;
		const result = treeRefC.updateNode(selectedNodeC.path, { name: editNameC.trim() });
		if (result.success) {
			const delay = await simulateLatency();
			// Update in mock DB
			const dbNode = mockDatabaseC.find(n => n.id === selectedNodeC!.data?.id);
			if (dbNode) dbNode.name = editNameC.trim();
			addLogC(`Updated "${selectedNodeC.path}" to "${editNameC}" - saved to DB (${delay}ms)`);
		}
		isLoadingC = false;
	}

	async function handleDeleteC() {
		if (!selectedNodeC) return;

		isLoadingC = true;
		const nodeName = selectedNodeC.data?.name;
		const result = treeRefC.removeNode(selectedNodeC.path);
		if (result.success) {
			const delay = await simulateLatency();
			mockDatabaseC = mockDatabaseC.filter(n => n.id !== selectedNodeC!.data?.id);
			addLogC(`Deleted "${nodeName}" - saved to DB (${delay}ms)`);
			selectedNodeC = null;
		}
		isLoadingC = false;
	}

	function onNodeClickC(node: LTreeNode<ScenarioNode>) {
		selectedNodeC = node;
		editNameC = node.data?.name || '';
	}

	function resetC() {
		targetDataC = [...createInitialTargetData()];
		mockDatabaseC = [...createInitialTargetData()];
		activityLogC = [];
		nextIdC = 3000;
		selectedNodeC = null;
		editNameC = '';
		addLogC('Reset to initial state');
	}

	// ==================== SCENARIO D: Empty + One by One ====================
	async function handleDropD(dropNode: LTreeNode<ScenarioNode> | null, draggedNode: LTreeNode<ScenarioNode>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) {
		const isSameTree = draggedNode.treeId === 'tree-d';

		isLoadingD = true;

		if (isSameTree && operation === 'move') {
			addLogD(`Moved "${draggedNode.data?.name}"`);
			const delay = await simulateLatency();
			addLogD(`Saved to DB (${delay}ms)`);
			isLoadingD = false;
			return;
		}

		// Add new node from source
		const parentPath = dropNode === null ? '' : (position === 'child' ? dropNode.path : (dropNode.parentPath || ''));

		// Calculate sortOrder based on position
		let sortOrder = 10;
		if (dropNode && position === 'before') {
			sortOrder = (dropNode.data?.sortOrder ?? 10) - 5;
		} else if (dropNode && position === 'after') {
			sortOrder = (dropNode.data?.sortOrder ?? 10) + 5;
		}

		const newNode: ScenarioNode = {
			...draggedNode.data!,
			id: nextIdD++,
			path: '',
			sortOrder
		};

		const result = treeRefD.addNode(parentPath, newNode);
		if (result.success) {
			const delay = await simulateLatency();
			mockDatabaseD = [...mockDatabaseD, result.node!.data!];
			addLogD(`Added "${newNode.name}" with sortOrder=${sortOrder} (${position} ${dropNode?.data?.name || 'root'}) (${delay}ms)`);
		}

		isLoadingD = false;
	}

	async function addRootNodeD() {
		const newNode: ScenarioNode = {
			id: nextIdD++,
			path: '',
			name: `Root ${nextIdD}`,
			icon: '📁',
			sortOrder: 10
		};

		isLoadingD = true;
		const result = treeRefD.addNode('', newNode);
		if (result.success) {
			const delay = await simulateLatency();
			mockDatabaseD = [...mockDatabaseD, result.node!.data!];
			addLogD(`Added root node "${newNode.name}" - saved to DB (${delay}ms)`);
		}
		isLoadingD = false;
	}

	function clearD() {
		targetDataD = [];
		mockDatabaseD = [];
		activityLogD = [];
		nextIdD = 4000;
		addLogD('Cleared tree and database');
	}

	// ==================== SCENARIO E: Batch Create Then Save ====================
	function handleDropE(dropNode: LTreeNode<ScenarioNode> | null, draggedNode: LTreeNode<ScenarioNode>, position: DropPosition, event: DragEvent | TouchEvent, operation: DropOperation) {
		const isSameTree = draggedNode.treeId === 'tree-e';

		if (isSameTree && operation === 'move') {
			addLogE(`Moved "${draggedNode.data?.name}" (not saved yet)`);
			unsavedCountE++;
			return;
		}

		// Copy node hierarchy without saving
		const parentPath = dropNode === null ? '' : (position === 'child' ? dropNode.path : (dropNode.parentPath || ''));

		// Calculate sortOrder based on position
		let rootSortOrder = 10;
		if (dropNode && position === 'before') {
			rootSortOrder = (dropNode.data?.sortOrder ?? 10) - 5;
		} else if (dropNode && position === 'after') {
			rootSortOrder = (dropNode.data?.sortOrder ?? 10) + 5;
		}

		let isFirst = true;
		const result = treeRefE.copyNodeWithDescendants(
			draggedNode,
			parentPath,
			(data) => {
				const order = isFirst ? rootSortOrder : (data.sortOrder || 10);
				isFirst = false;
				return { ...data, id: nextIdE++, path: '', sortOrder: order };
			}
		);

		if (result.success) {
			unsavedCountE += result.count;
			addLogE(`Added ${result.count} node(s) with sortOrder=${rootSortOrder} (${position} ${dropNode?.data?.name || 'root'}) - NOT saved`);
		}
	}

	function addRootNodeE() {
		const newNode: ScenarioNode = {
			id: nextIdE++,
			path: '',
			name: `Item ${nextIdE}`,
			icon: '📄',
			sortOrder: 10
		};

		const result = treeRefE.addNode('', newNode);
		if (result.success) {
			unsavedCountE++;
			addLogE(`Added "${newNode.name}" (NOT saved - ${unsavedCountE} unsaved total)`);
		}
	}

	async function saveAllE() {
		isLoadingE = true;

		const allData = treeRefE.getAllData();
		addLogE(`Extracting ${allData.length} nodes with getAllData()...`);

		const delay1 = await simulateLatency();
		addLogE(`Preparing batch insert (${delay1}ms)...`);
		const delay2 = await simulateLatency();

		mockDatabaseE = [...allData];
		unsavedCountE = 0;
		addLogE(`Batch saved ${allData.length} nodes to DB! (total: ${delay1 + delay2}ms)`);

		isLoadingE = false;
	}

	function clearE() {
		targetDataE = [];
		mockDatabaseE = [];
		activityLogE = [];
		nextIdE = 5000;
		unsavedCountE = 0;
		addLogE('Cleared tree (database was already empty)');
	}

	// Get current scenario's activity log
	function getCurrentLog(): string[] {
		switch (activeTab) {
			case 'A': return activityLogA;
			case 'B': return activityLogB;
			case 'C': return activityLogC;
			case 'D': return activityLogD;
			case 'E': return activityLogE;
		}
	}

	// Get current scenario's mock database
	function getCurrentDb(): ScenarioNode[] {
		switch (activeTab) {
			case 'A': return mockDatabaseA;
			case 'B': return mockDatabaseB;
			case 'C': return mockDatabaseC;
			case 'D': return mockDatabaseD;
			case 'E': return mockDatabaseE;
		}
	}
</script>

<svelte:head>
	<title>Business Scenarios - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<ExampleHeader
		title="Business Scenarios"
		subtitle="Real-world tree manipulation workflows with database integration"
	/>

	<!-- Scenario Tabs -->
	<div class="card">
		<div class="tabs">
			{#each ['A', 'B', 'C', 'D', 'E'] as tab}
				<button
					class="tab"
					class:active={activeTab === tab}
					onclick={() => activeTab = tab as Scenario}
				>
					Scenario {tab}
				</button>
			{/each}
		</div>

		<!-- Scenario Description -->
		<div class="scenario-info">
			<h2>{scenarioDescriptions[activeTab].title}</h2>
			<p>{scenarioDescriptions[activeTab].description}</p>
			<p class="key-feature">Key feature: <code>{scenarioDescriptions[activeTab].keyFeature}</code></p>
		</div>
	</div>

	<!-- Trees Side by Side -->
	<div class="card">
		<div class="trees-side-by-side">
			<!-- Source Tree (shared) -->
			<div>
				<h3>Source Tree (drag from here)</h3>
				<div class="tree-container">
					<Tree
						treeId="source-tree"
						data={sourceData}
						idMember="id"
						pathMember="path"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						dragDropMode="cross"
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span><small class="node-id">[{node.data?.id}]</small> {node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>

			<!-- Target Tree (per scenario) -->
			<div>
				<h3>
					Target Tree
					{#if activeTab === 'E' && unsavedCountE > 0}
						<span class="unsaved-badge">{unsavedCountE} unsaved</span>
					{/if}
				</h3>
				<div class="tree-container">
					{#if activeTab === 'A'}
						<Tree
							bind:this={treeRefA}
							treeId="tree-a"
							data={targetDataA}
							idMember="id"
							pathMember="path"
							orderMember="sortOrder"
							sortCallback={sortByOrder}
							expandLevel={3}
							dragDropMode="cross"
							onNodeDrop={handleDropA}
							isLoading={isLoadingA}
							{...getTreeProps()}
						>
							{#snippet nodeTemplate(node: any)}
								<span><small class="node-id">[{node.data?.id}]</small> {node.data?.icon} {node.data?.name}</span>
							{/snippet}
						</Tree>
					{:else if activeTab === 'B'}
						<Tree
							bind:this={treeRefB}
							treeId="tree-b"
							data={targetDataB}
							idMember="id"
							pathMember="path"
							orderMember="sortOrder"
							sortCallback={sortByOrder}
							expandLevel={3}
							dragDropMode="cross"
							onNodeDrop={handleDropB}
							isLoading={isLoadingB}
							{...getTreeProps()}
						>
							{#snippet nodeTemplate(node: any)}
								<span><small class="node-id">[{node.data?.id}]</small> {node.data?.icon} {node.data?.name}</span>
							{/snippet}
						</Tree>
					{:else if activeTab === 'C'}
						<Tree
							bind:this={treeRefC}
							treeId="tree-c"
							data={targetDataC}
							idMember="id"
							pathMember="path"
							orderMember="sortOrder"
							sortCallback={sortByOrder}
							expandLevel={3}
							dragDropMode="cross"
							onNodeDrop={handleDropC}
							onNodeClick={onNodeClickC}
							focusedNode={selectedNodeC}
							isLoading={isLoadingC}
							{...getTreeProps()}
						>
							{#snippet nodeTemplate(node: any)}
								<span><small class="node-id">[{node.data?.id}]</small> {node.data?.icon} {node.data?.name}</span>
							{/snippet}
						</Tree>
					{:else if activeTab === 'D'}
						<Tree
							bind:this={treeRefD}
							treeId="tree-d"
							data={targetDataD}
							idMember="id"
							pathMember="path"
							orderMember="sortOrder"
							sortCallback={sortByOrder}
							expandLevel={3}
							dragDropMode="cross"
							onNodeDrop={handleDropD}
							isLoading={isLoadingD}
							{...getTreeProps()}
						>
							{#snippet nodeTemplate(node: any)}
								<span><small class="node-id">[{node.data?.id}]</small> {node.data?.icon} {node.data?.name}</span>
							{/snippet}
							{#snippet noDataFound()}
								<div class="drop-placeholder-content">
									<p class="placeholder-icon">📂</p>
									<p>Empty tree — drag items here or click "Add Root Node"</p>
								</div>
							{/snippet}
							{#snippet dropPlaceholder()}
								<div class="drop-placeholder-content">
									<p class="placeholder-icon">📥</p>
									<p>Drag items here or click "Add Root Node"</p>
								</div>
							{/snippet}
						</Tree>
					{:else if activeTab === 'E'}
						<Tree
							bind:this={treeRefE}
							treeId="tree-e"
							data={targetDataE}
							idMember="id"
							pathMember="path"
							orderMember="sortOrder"
							sortCallback={sortByOrder}
							expandLevel={3}
							dragDropMode="cross"
							onNodeDrop={handleDropE}
							isLoading={isLoadingE}
							{...getTreeProps()}
						>
							{#snippet nodeTemplate(node: any)}
								<span><small class="node-id">[{node.data?.id}]</small> {node.data?.icon} {node.data?.name}</span>
							{/snippet}
							{#snippet noDataFound()}
								<div class="drop-placeholder-content">
									<p class="placeholder-icon">📂</p>
									<p>Empty tree — drag items here or add nodes</p>
								</div>
							{/snippet}
							{#snippet dropPlaceholder()}
								<div class="drop-placeholder-content">
									<p class="placeholder-icon">📥</p>
									<p>Build your tree structure, then "Save All"</p>
								</div>
							{/snippet}
						</Tree>
					{/if}
				</div>
			</div>
		</div>

		<!-- Scenario-specific Controls -->
		<div class="controls">
			{#if activeTab === 'A'}
				<button class="btn" onclick={reloadFromDbA}>Reload from DB</button>
				<button class="btn btn-secondary" onclick={resetA}>Reset</button>
			{:else if activeTab === 'B'}
				<button class="btn btn-secondary" onclick={resetB}>Reset</button>
				<span class="hint">Same-tree moves are auto-handled by the library</span>
			{:else if activeTab === 'C'}
				<button class="btn" onclick={handleAddC}>Add Child</button>
				<input type="text" bind:value={editNameC} placeholder="New name..." />
				<button class="btn" onclick={handleUpdateC} disabled={!selectedNodeC}>Update Name</button>
				<button class="btn btn-danger" onclick={handleDeleteC} disabled={!selectedNodeC}>Delete</button>
				<button class="btn btn-secondary" onclick={resetC}>Reset</button>
			{:else if activeTab === 'D'}
				<button class="btn" onclick={addRootNodeD}>Add Root Node</button>
				<button class="btn btn-secondary" onclick={clearD}>Clear All</button>
			{:else if activeTab === 'E'}
				<button class="btn" onclick={addRootNodeE}>Add Node</button>
				<button class="btn btn-primary" onclick={saveAllE} disabled={unsavedCountE === 0}>
					Save All ({unsavedCountE} unsaved)
				</button>
				<button class="btn btn-secondary" onclick={clearE}>Clear All</button>
			{/if}
		</div>
	</div>

	<!-- Activity Log -->
	<div class="card">
		<h3>Activity Log</h3>
		<div class="output">
			{#if getCurrentLog().length > 0}
				<pre>{getCurrentLog().join('\n')}</pre>
			{:else}
				<p class="empty-log">No activity yet. Try dragging nodes or using the controls above.</p>
			{/if}
		</div>
	</div>

	<!-- Mock Database -->
	<div class="card">
		<details>
			<summary>Mock Database ({getCurrentDb().length} records)</summary>
			<div class="output">
				<pre>{JSON.stringify(getCurrentDb(), null, 2)}</pre>
			</div>
		</details>
	</div>

	<!-- Code Example -->
	<div class="card">
		<h3>Code Example - Scenario {activeTab}</h3>
		<div class="code-block">
			{#if activeTab === 'A'}
				<pre>{`// Scenario A: Full Redraw with State Preservation
async function handleDrop(dropNode, draggedNode, position) {
  // 1. Save expanded state BEFORE changes
  const expandedPaths = treeRef.getExpandedPaths();

  // 2. Save to database
  await saveToDatabase(draggedNode);

  // 3. Reload FULL tree from database
  targetData = await loadFromDatabase();

  // 4. Restore expanded state
  await tick();
  treeRef.setExpandedPaths(expandedPaths);
}`}</pre>
			{:else if activeTab === 'B'}
				<pre>{`// Scenario B: Partial Redraw (Recommended)
async function handleDrop(dropNode, draggedNode, position) {
  // Same-tree moves are AUTO-HANDLED by the library!
  // Library calls moveNode() internally - no rebuild needed.

  // Just save to DB for persistence
  await saveToDatabase({
    action: 'move',
    from: draggedNode.path,
    to: dropNode.path,
    position
  });

  // Tree is already updated - no reload needed!
}`}</pre>
			{:else if activeTab === 'C'}
				<pre>{`// Scenario C: Individual CRUD Operations
async function handleAdd() {
  const result = treeRef.addNode(parentPath, newData);
  if (result.success) {
    await saveToDatabase(result.node.data);
  }
}

async function handleUpdate() {
  const result = treeRef.updateNode(path, { name: newName });
  if (result.success) {
    await saveToDatabase(result.node.data);
  }
}

async function handleDelete() {
  const result = treeRef.removeNode(path);
  if (result.success) {
    await deleteFromDatabase(path);
  }
}`}</pre>
			{:else if activeTab === 'D'}
				<pre>{`// Scenario D: Empty Tree + One by One
// Use dropPlaceholder for empty state
<Tree onNodeDrop={handleDrop}>
  {#snippet dropPlaceholder()}
    <div>Drop items here to start building</div>
  {/snippet}
</Tree>

async function handleDrop(dropNode, draggedNode, position) {
  const newNode = { ...draggedNode.data, id: nextId++ };
  const result = treeRef.addNode(dropNode?.path || '', newNode);

  if (result.success) {
    // Save immediately
    await saveToDatabase(result.node.data);
  }
}`}</pre>
			{:else if activeTab === 'E'}
				<pre>{`// Scenario E: Batch Create Then Save
function handleDrop(dropNode, draggedNode, position) {
  // Add to tree WITHOUT saving
  treeRef.copyNodeWithDescendants(
    draggedNode,
    dropNode?.path || '',
    (data) => ({ ...data, id: nextId++ })
  );
  unsavedCount++;
}

async function saveAll() {
  // Extract ALL data from tree
  const allData = treeRef.getAllData();

  // Batch save to database
  await saveBatchToDatabase(allData);
}`}</pre>
			{/if}
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>

<style>
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		border-bottom: 2px solid #e2e8f0;
		padding-bottom: 0.5rem;
	}

	.tab {
		padding: 0.5rem 1rem;
		border: none;
		background: #f1f5f9;
		border-radius: 4px 4px 0 0;
		cursor: pointer;
		font-weight: 500;
		color: #64748b;
		transition: all 0.2s;
	}

	.tab:hover {
		background: #e2e8f0;
	}

	.tab.active {
		background: #667eea;
		color: white;
	}

	.scenario-info {
		padding: 1rem;
		background: #f8fafc;
		border-radius: 4px;
	}

	.scenario-info h2 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.scenario-info p {
		margin: 0.5rem 0;
		color: #475569;
	}

	.key-feature {
		font-weight: 500;
	}

	.key-feature code {
		background: #e0e7ff;
		color: #4338ca;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.trees-side-by-side {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 1rem;
	}

	.trees-side-by-side h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: #374151;
	}

	.tree-container {
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		padding: 0.5rem;
		min-height: 300px;
		max-height: 400px;
		overflow: auto;
		background: #fafafa;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		padding-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
		background: #667eea;
		color: white;
		transition: background 0.2s;
	}

	.btn:hover:not(:disabled) {
		background: #5a67d8;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #e2e8f0;
		color: #475569;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #cbd5e1;
	}

	.btn-danger {
		background: #ef4444;
	}

	.btn-danger:hover:not(:disabled) {
		background: #dc2626;
	}

	.btn-primary {
		background: #22c55e;
	}

	.btn-primary:hover:not(:disabled) {
		background: #16a34a;
	}

	.controls input[type="text"] {
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		width: 150px;
	}

	.hint {
		color: #64748b;
		font-size: 0.875rem;
		font-style: italic;
	}

	.output {
		background: #1e293b;
		color: #e2e8f0;
		border-radius: 4px;
		padding: 1rem;
		font-family: monospace;
		font-size: 0.875rem;
		max-height: 200px;
		overflow: auto;
	}

	.output pre {
		margin: 0;
		white-space: pre-wrap;
	}

	.empty-log {
		color: #64748b;
		font-style: italic;
		margin: 0;
	}

	.code-block {
		background: #1e293b;
		color: #e2e8f0;
		border-radius: 4px;
		padding: 1rem;
		overflow-x: auto;
	}

	.code-block pre {
		margin: 0;
		font-family: 'Fira Code', monospace;
		font-size: 0.875rem;
	}

	details {
		cursor: pointer;
	}

	details summary {
		font-weight: 500;
		padding: 0.5rem 0;
	}

	.unsaved-badge {
		background: #fbbf24;
		color: #78350f;
		padding: 0.2rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		margin-left: 0.5rem;
	}

	.drop-placeholder-content {
		text-align: center;
		padding: 2rem;
		color: #667eea;
	}

	.placeholder-icon {
		font-size: 2rem;
		margin: 0;
	}

	.node-id {
		color: #94a3b8;
		font-family: monospace;
		font-size: 0.75rem;
		margin-right: 0.25rem;
	}

	footer {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid #e2e8f0;
	}

	footer a {
		color: #667eea;
		text-decoration: none;
	}

	footer a:hover {
		text-decoration: underline;
	}

	@media (max-width: 768px) {
		.trees-side-by-side {
			grid-template-columns: 1fr;
		}

		.tabs {
			flex-wrap: wrap;
		}
	}
</style>
