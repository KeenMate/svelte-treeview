<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';
	
	// Source data - draggable items
	const sourceData = [
		{ id: 's1', path: '1', name: '📋 Task Board', type: 'container', isDraggable: true, isDropAllowed: false },
		{ id: 's2', path: '1.1', name: '📝 Create User Stories', type: 'task', isDraggable: true, isDropAllowed: false, status: 'todo' },
		{ id: 's3', path: '1.2', name: '🎨 Design Mockups', type: 'task', isDraggable: true, isDropAllowed: false, status: 'todo' },
		{ id: 's4', path: '1.3', name: '💻 Frontend Development', type: 'task', isDraggable: true, isDropAllowed: false, status: 'todo' },
		{ id: 's5', path: '1.4', name: '🔧 Backend API', type: 'task', isDraggable: true, isDropAllowed: false, status: 'todo' },
		{ id: 's6', path: '1.5', name: '🧪 Testing & QA', type: 'task', isDraggable: true, isDropAllowed: false, status: 'todo' },
		{ id: 's7', path: '2', name: '📁 Resources', type: 'container', isDraggable: false, isDropAllowed: false },
		{ id: 's8', path: '2.1', name: '📖 Documentation', type: 'resource', isDraggable: true, isDropAllowed: false },
		{ id: 's9', path: '2.2', name: '🖼️ Image Assets', type: 'resource', isDraggable: true, isDropAllowed: false },
		{ id: 's10', path: '2.3', name: '🎯 Brand Guidelines', type: 'resource', isDraggable: true, isDropAllowed: false }
	];
	
	// Target data - drop zones
	let targetData = $state([
		{ id: 't1', path: '1', name: '📋 Project Status', type: 'container', isDraggable: false, isDropAllowed: true },
		{ id: 't2', path: '1.1', name: '🔄 In Progress', type: 'status', isDraggable: false, isDropAllowed: true, items: [] },
		{ id: 't3', path: '1.2', name: '✅ Completed', type: 'status', isDraggable: false, isDropAllowed: true, items: [] },
		{ id: 't4', path: '1.3', name: '🚫 Blocked', type: 'status', isDraggable: false, isDropAllowed: true, items: [] },
		{ id: 't5', path: '2', name: '📁 Team Assignments', type: 'container', isDraggable: false, isDropAllowed: true },
		{ id: 't6', path: '2.1', name: '👨‍💻 Frontend Team', type: 'team', isDraggable: false, isDropAllowed: true, items: [] },
		{ id: 't7', path: '2.2', name: '🔧 Backend Team', type: 'team', isDraggable: false, isDropAllowed: true, items: [] },
		{ id: 't8', path: '2.3', name: '🎨 Design Team', type: 'team', isDraggable: false, isDropAllowed: true, items: [] }
	]);
	
	// Drag state tracking
	let draggedNode = $state(null);
	let dropHistory = $state([]);
	
	// Event handlers
	function handleDragStart(node, event) {
		draggedNode = node;
		console.log('Drag started:', node.data.name);
		
		// Set drag effect
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', node.data.name);
		
		// Add visual feedback
		if (event.target) {
			event.target.style.opacity = '0.5';
		}
	}
	
	function handleDragOver(node, event) {
		// Prevent default to allow drop
		event.preventDefault();
		
		// Validate drop target
		if (node.data.isDropAllowed) {
			event.dataTransfer.dropEffect = 'move';
		} else {
			event.dataTransfer.dropEffect = 'none';
		}
	}
	
	function handleDrop(dropNode, draggedNode, event) {
		event.preventDefault();
		
		if (!dropNode.data.isDropAllowed) {
			console.log('Drop not allowed on:', dropNode.data.name);
			return;
		}
		
		// Add to drop history
		dropHistory.push({
			id: Date.now(),
			draggedItem: draggedNode.data.name,
			dropTarget: dropNode.data.name,
			timestamp: new Date().toLocaleTimeString()
		});
		
		// Keep only last 10 entries
		if (dropHistory.length > 10) {
			dropHistory = dropHistory.slice(-10);
		}
		
		console.log(`Dropped "${draggedNode.data.name}" onto "${dropNode.data.name}"`);
		
		// Reset drag styles
		const draggedElement = document.querySelector('[style*="opacity: 0.5"]');
		if (draggedElement) {
			draggedElement.style.opacity = '';
		}
	}
	
	// Sort callback
	const sortCallback = (items) => {
		return items.sort((a, b) => {
			const typeOrder = { container: 0, status: 1, team: 1, task: 2, resource: 2 };
			const aOrder = typeOrder[a.data.type] || 3;
			const bOrder = typeOrder[b.data.type] || 3;
			
			if (aOrder !== bOrder) {
				return aOrder - bOrder;
			}
			return a.data.name.localeCompare(b.data.name);
		});
	};
</script>

<div class="container">
	<div class="row mb-4">
		<div class="col-12">
			<h1>Drag & Drop</h1>
			<p class="lead">Interactive drag and drop functionality with validation and visual feedback.</p>
		</div>
	</div>

	<ShowcaseSection 
		title="Basic Drag & Drop" 
		subtitle="Drag tasks from the source tree to the target tree">
		{#snippet demo()}
			<div class="row">
				<div class="col-6">
					<h6 class="text-primary mb-3">📦 Source (Draggable Items)</h6>
					<Tree 
						data={sourceData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						isDraggableMember="isDraggable"
						isDropAllowedMember="isDropAllowed"
						expandLevel={3}
						sortCallback={sortCallback}
						onNodeDragStart={handleDragStart}
						onNodeDragOver={handleDragOver}
					>
						{#snippet nodeTemplate(node)}
							<div class="d-flex align-items-center {node.isDraggable ? 'draggable-item' : ''}">
								<span class="me-2">{node.data.name}</span>
								{#if node.isDraggable}
									<small class="badge bg-success">Draggable</small>
								{/if}
							</div>
						{/snippet}
					</Tree>
				</div>
				
				<div class="col-6">
					<h6 class="text-success mb-3">🎯 Target (Drop Zones)</h6>
					<Tree 
						data={targetData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						isDraggableMember="isDraggable"
						isDropAllowedMember="isDropAllowed"
						expandLevel={3}
						sortCallback={sortCallback}
						onNodeDragOver={handleDragOver}
						onNodeDrop={handleDrop}
					>
						{#snippet nodeTemplate(node)}
							<div class="d-flex align-items-center {node.data.isDropAllowed ? 'drop-zone' : ''}">
								<span class="me-2">{node.data.name}</span>
								{#if node.data.isDropAllowed}
									<small class="badge bg-warning">Drop Zone</small>
								{/if}
							</div>
						{/snippet}
					</Tree>
				</div>
			</div>
		{/snippet}
		
		{#snippet controls()}
			<div class="mb-3">
				<h6>🎯 Currently Dragging:</h6>
				{#if draggedNode}
					<div class="alert alert-info">
						<strong>{draggedNode.data.name}</strong>
						<br><small>Type: {draggedNode.data.type}</small>
					</div>
				{:else}
					<div class="text-muted">No item being dragged</div>
				{/if}
			</div>
			
			<div class="mb-3">
				<h6>📋 Drop History:</h6>
				{#if dropHistory.length > 0}
					<div class="drop-history">
						{#each dropHistory.slice().reverse() as drop}
							<div class="alert alert-success py-2">
								<small>
									<strong>{drop.draggedItem}</strong> → <strong>{drop.dropTarget}</strong>
									<br><span class="text-muted">{drop.timestamp}</span>
								</small>
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-muted">No drops yet - try dragging items!</div>
				{/if}
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Drag & Drop Events</h6>
			<p><code>onNodeDragStart</code> - Fired when dragging begins</p>
			<p><code>onNodeDragOver</code> - Fired when hovering over potential targets</p>
			<p><code>onNodeDrop</code> - Fired when item is dropped</p>
			
			<h6>Property Configuration</h6>
			<p><code>isDraggableMember</code> - Property defining which nodes can be dragged</p>
			<p><code>isDropAllowedMember</code> - Property defining valid drop targets</p>
			
			<h6>Event Data</h6>
			<p>All events receive the node object and native drag event, allowing full customization of drag behavior.</p>
			
			<h6>Visual Feedback</h6>
			<p>Use CSS classes and drag event properties to provide visual cues during drag operations.</p>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection 
		title="Drag Validation & Styling" 
		subtitle="Custom validation logic and visual feedback">
		{#snippet demo()}
			<div class="bg-light p-3 rounded">
				<h6>Drag Rules in Effect:</h6>
				<ul class="small mb-0">
					<li>✅ <strong>Tasks</strong> can be dragged to status zones (In Progress, Completed, Blocked)</li>
					<li>✅ <strong>Resources</strong> can be assigned to team zones (Frontend, Backend, Design)</li>
					<li>❌ <strong>Containers</strong> cannot be dragged</li>
					<li>❌ Items cannot be dropped on non-drop zones</li>
				</ul>
			</div>
		{/snippet}
		
		{#snippet controls()}
			<div class="code-example">
				<h6>Event Handler Example:</h6>
				<pre class="bg-dark text-light p-3 rounded small"><code>{`function handleDrop(dropNode, draggedNode, event) {
  // Validate drop target
  if (!dropNode.data.isDropAllowed) {
    return; // Reject drop
  }
  
  // Custom business logic
  if (draggedNode.data.type === 'task' && 
      dropNode.data.type === 'status') {
    // Allow task → status drops
    updateTaskStatus(draggedNode, dropNode);
  }
  
  // Log the action
  console.log(\`Moved \${draggedNode.data.name} 
    to \${dropNode.data.name}\`);
}`}</code></pre>
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Validation Approaches</h6>
			<p><strong>Property-based:</strong> Use <code>isDropAllowed</code> for simple validation</p>
			<p><strong>Event-based:</strong> Implement custom logic in <code>onNodeDrop</code> handler</p>
			
			<h6>Visual States</h6>
			<p>Apply CSS classes based on drag state:</p>
			<ul class="small">
				<li><code>.draggable-item</code> - Style draggable nodes</li>
				<li><code>.drop-zone</code> - Highlight valid drop targets</li>
				<li><code>.drag-over</code> - Show hover state during drag</li>
			</ul>
			
			<h6>Business Logic Integration</h6>
			<p>Drop events can trigger state updates, API calls, or other application logic.</p>
		{/snippet}
	</ShowcaseSection>
</div>

<style>
	.draggable-item {
		cursor: grab;
		transition: all 0.2s ease;
	}
	
	.draggable-item:hover {
		background-color: #e3f2fd;
		border-radius: 0.25rem;
	}
	
	.drop-zone {
		border: 2px dashed transparent;
		transition: all 0.2s ease;
	}
	
	.drop-zone:hover {
		border-color: #28a745;
		background-color: #f8fff8;
		border-radius: 0.25rem;
	}
	
	.drop-history {
		max-height: 300px;
		overflow-y: auto;
	}
	
	.code-example pre {
		font-size: 0.8rem;
		line-height: 1.4;
		white-space: pre-wrap;
	}
	
	:global(.ltree-node[draggable="true"]) {
		cursor: grab;
	}
	
	:global(.ltree-node[draggable="true"]:active) {
		cursor: grabbing;
	}
</style>