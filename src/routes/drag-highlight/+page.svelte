<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';
	
	// Source items (draggable)
	const sourceItems = [
		{ id: 'item1', path: 'item1', name: '📄 Document.pdf', type: 'document', isDraggable: true },
		{ id: 'item2', path: 'item2', name: '📊 Report.xlsx', type: 'spreadsheet', isDraggable: true },
		{ id: 'item3', path: 'item3', name: '🖼️ Image.png', type: 'image', isDraggable: true },
		{ id: 'item4', path: 'item4', name: '🎵 Audio.mp3', type: 'audio', isDraggable: true },
		{ id: 'item5', path: 'item5', name: '🎬 Video.mp4', type: 'video', isDraggable: true }
	];

	// Target folders (drop zones)
	const targetFolders = [
		{ id: 'work', path: 'work', name: '💼 Work Folder', type: 'folder', children: [] },
		{ id: 'work.documents', path: 'work.documents', name: '📁 Documents', type: 'subfolder' },
		{ id: 'work.projects', path: 'work.projects', name: '🏗️ Projects', type: 'subfolder' },
		{ id: 'personal', path: 'personal', name: '🏠 Personal Folder', type: 'folder', children: [] },
		{ id: 'personal.photos', path: 'personal.photos', name: '📷 Photos', type: 'subfolder' },
		{ id: 'personal.music', path: 'personal.music', name: '🎶 Music', type: 'subfolder' },
		{ id: 'archive', path: 'archive', name: '📦 Archive Folder', type: 'folder', children: [] },
		{ id: 'archive.old', path: 'archive.old', name: '🗄️ Old Files', type: 'subfolder' }
	];

	// Demo data for different highlight styles
	const highlightDemo = [
		{ id: 'demo1', path: 'demo1', name: 'Drag me over folders below', type: 'item', isDraggable: true },
		{ id: 'folder1', path: 'folder1', name: '📁 Highlight Demo Folder', type: 'folder' },
		{ id: 'folder2', path: 'folder2', name: '📁 Glow Demo Folder', type: 'folder' }
	];

	// State for tracking drops
	let dropLog = $state([]);
	let draggedItem = $state(null);

	function handleDragStart(node, event) {
		draggedItem = node;
		console.log('Dragging:', node.data.name);
	}

	function handleDrop(dropNode, draggedNode, event) {
		const timestamp = new Date().toLocaleTimeString();
		dropLog = [
			...dropLog,
			{
				id: Date.now(),
				timestamp,
				draggedItem: draggedNode.data.name,
				dropTarget: dropNode.data.name,
				success: true
			}
		].slice(-5); // Keep only last 5 drops

		draggedItem = null;
		console.log(`Dropped ${draggedNode.data.name} onto ${dropNode.data.name}`);
	}

	function clearLog() {
		dropLog = [];
	}

	// Sort callback
	const sortCallback = (items: any[]) => {
		return items.sort((a, b) => {
			// Folders first, then by name
			if (a.data.type === 'folder' && b.data.type !== 'folder') return -1;
			if (b.data.type === 'folder' && a.data.type !== 'folder') return 1;
			return a.data.name.localeCompare(b.data.name);
		});
	};
</script>

<div class="container-fluid">
	<div class="row mb-4">
		<div class="col-12">
			<h1>Drag-over Highlighting</h1>
			<p class="lead">Visual feedback during drag-and-drop operations with customizable highlight styles.</p>
		</div>
	</div>

	<ShowcaseSection 
		title="Drag-over Highlight Styles" 
		subtitle="Compare the different visual feedback options">
		{#snippet demo()}
			<div class="row">
				<div class="col-md-6">
					<h6>Highlight Style (Dashed Border)</h6>
					<Tree 
						data={highlightDemo}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						dragOverNodeClass="ltree-dragover-highlight"
						expandLevel={2}
						onNodeDragStart={handleDragStart}
						onNodeDrop={handleDrop}
						sortCallback={sortCallback}
					>
						{#snippet nodeTemplate(node)}
							<div class="d-flex align-items-center">
								<span class="me-2">
									{#if node.data.type === 'item'}🔄
									{:else if node.data.type === 'folder'}📁
									{:else}📄{/if}
								</span>
								<div>
									<div class="fw-semibold">{node.data.name}</div>
									<small class="text-muted">
										{node.data.type === 'item' ? 'Draggable item' : 'Drop zone with dashed highlight'}
									</small>
								</div>
							</div>
						{/snippet}
					</Tree>
				</div>
				
				<div class="col-md-6">
					<h6>Glow Style (Shadow Effect)</h6>
					<Tree 
						data={highlightDemo}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						dragOverNodeClass="ltree-dragover-glow"
						expandLevel={2}
						onNodeDragStart={handleDragStart}
						onNodeDrop={handleDrop}
						sortCallback={sortCallback}
					>
						{#snippet nodeTemplate(node)}
							<div class="d-flex align-items-center">
								<span class="me-2">
									{#if node.data.type === 'item'}🔄
									{:else if node.data.type === 'folder'}📁
									{:else}📄{/if}
								</span>
								<div>
									<div class="fw-semibold">{node.data.name}</div>
									<small class="text-muted">
										{node.data.type === 'item' ? 'Draggable item' : 'Drop zone with glow highlight'}
									</small>
								</div>
							</div>
						{/snippet}
					</Tree>
				</div>
			</div>
		{/snippet}
		
		{#snippet controls()}
			<div class="alert alert-info">
				<h6>💡 How to Test</h6>
				<p class="mb-2">
					<strong>1.</strong> Drag the "Drag me over folders below" item<br>
					<strong>2.</strong> Hover over the folder items to see highlight effects<br>
					<strong>3.</strong> Compare the dashed border (left) vs glow effect (right)
				</p>
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Available Drag-over Classes</h6>
			<ul class="small">
				<li><strong>ltree-dragover-highlight</strong>: Green dashed border with subtle background</li>
				<li><strong>ltree-dragover-glow</strong>: Blue glowing shadow effect with primary color theme</li>
			</ul>
			
			<h6>Usage</h6>
			<pre><code>&lt;Tree 
  data=&#123;items&#125;
  dragOverNodeClass="ltree-dragover-highlight"
  onNodeDrop=&#123;handleDrop&#125;
/&gt;</code></pre>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection 
		title="Interactive File Organization" 
		subtitle="Drag files from the source list to organize them into folders">
		{#snippet demo()}
			<div class="row">
				<div class="col-md-6">
					<h6>📋 Source Items (Draggable)</h6>
					<Tree 
						data={sourceItems}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						expandLevel={1}
						onNodeDragStart={handleDragStart}
						sortCallback={sortCallback}
					>
						{#snippet nodeTemplate(node)}
							<div class="d-flex align-items-center">
								<span class="me-2">{node.data.name.split(' ')[0]}</span>
								<div>
									<div class="fw-semibold">{node.data.name.split(' ').slice(1).join(' ')}</div>
									<small class="text-muted">Click and drag to move</small>
								</div>
							</div>
						{/snippet}
					</Tree>
				</div>
				
				<div class="col-md-6">
					<h6>📁 Target Folders (Drop Zones)</h6>
					<Tree 
						data={targetFolders}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						dragOverNodeClass="ltree-dragover-highlight"
						expandLevel={2}
						onNodeDrop={handleDrop}
						sortCallback={sortCallback}
					>
						{#snippet nodeTemplate(node)}
							<div class="d-flex align-items-center">
								<span class="me-2">{node.data.name.split(' ')[0]}</span>
								<div>
									<div class="fw-semibold">{node.data.name.split(' ').slice(1).join(' ')}</div>
									<small class="text-muted">
										{node.data.type === 'folder' ? 'Main folder' : 'Subfolder'}
									</small>
								</div>
							</div>
						{/snippet}
					</Tree>
				</div>
			</div>
			
			{#if dropLog.length > 0}
				<div class="mt-4">
					<div class="d-flex justify-content-between align-items-center mb-2">
						<h6>📊 Recent Drop Operations</h6>
						<button class="btn btn-sm btn-outline-secondary" onclick={clearLog}>Clear Log</button>
					</div>
					<div class="list-group">
						{#each dropLog as entry (entry.id)}
							<div class="list-group-item list-group-item-success">
								<div class="d-flex justify-content-between align-items-start">
									<div>
										<strong>{entry.draggedItem}</strong> → <strong>{entry.dropTarget}</strong>
									</div>
									<small class="text-muted">{entry.timestamp}</small>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/snippet}
		
		{#snippet controls()}
			<div class="alert alert-primary">
				<h6>🎯 Try This</h6>
				<p class="mb-2">
					<strong>1.</strong> Drag any file from the left tree<br>
					<strong>2.</strong> Hover over folders on the right - notice the highlight<br>
					<strong>3.</strong> Drop the file onto a folder to see it logged<br>
					<strong>4.</strong> Watch the drop log update in real-time
				</p>
			</div>
			
			{#if draggedItem}
				<div class="alert alert-info">
					<strong>Currently Dragging:</strong> {draggedItem.data.name}
				</div>
			{/if}
		{/snippet}
		
		{#snippet description()}
			<h6>Real-world Use Case</h6>
			<p>This demonstrates a typical file management scenario where users drag files into folders for organization.</p>
			
			<h6>Visual Feedback Benefits</h6>
			<ul class="small">
				<li><strong>Clear Targeting</strong>: Users can see exactly which folder will receive the file</li>
				<li><strong>Reduced Errors</strong>: Visual confirmation prevents accidental drops</li>
				<li><strong>Professional Feel</strong>: Smooth transitions and clear indicators</li>
				<li><strong>Accessibility</strong>: High contrast highlights for better visibility</li>
			</ul>
			
			<h6>Implementation Details</h6>
			<ul class="small">
				<li>Automatic state management prevents flickering</li>
				<li>Proper drag event boundary detection</li>
				<li>CSS transitions for smooth visual feedback</li>
				<li>Theme-aware colors using CSS custom properties</li>
			</ul>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection 
		title="Custom Styling Options" 
		subtitle="How to create your own drag-over highlight styles">
		{#snippet demo()}
			<div class="bg-light p-3 rounded">
				<h6>CSS Custom Properties</h6>
				<p class="small mb-2">The drag-over classes use theme colors that can be customized:</p>
				<pre><code>:root &#123;
  --ltree-success: #198754;      /* Used by ltree-dragover-highlight */
  --ltree-success-rgb: 25, 135, 84;
  --ltree-primary: #0d6efd;      /* Used by ltree-dragover-glow */
  --ltree-primary-rgb: 13, 110, 253;
&#125;</code></pre>
			</div>
			
			<div class="bg-light p-3 rounded mt-3">
				<h6>Creating Custom Classes</h6>
				<pre><code>.my-custom-dragover &#123;
  background-color: rgba(255, 193, 7, 0.2) !important;
  border: 3px solid #ffc107 !important;
  border-radius: 8px !important;
  transform: scale(1.05) !important;
  transition: all 0.3s ease !important;
&#125;</code></pre>
			</div>
		{/snippet}
		
		{#snippet controls()}
			<div class="alert alert-warning">
				<h6>⚠️ Important Notes</h6>
				<ul class="small mb-0">
					<li>Use <code>!important</code> to override default styles</li>
					<li>Include smooth transitions for professional feel</li>
					<li>Test with different themes and color schemes</li>
					<li>Consider accessibility and contrast ratios</li>
				</ul>
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Customization Approaches</h6>
			<ul class="small">
				<li><strong>CSS Variables</strong>: Change theme colors globally</li>
				<li><strong>Custom Classes</strong>: Create completely new highlight styles</li>
				<li><strong>Conditional Classes</strong>: Different styles based on node type or data</li>
			</ul>
			
			<h6>Design Considerations</h6>
			<ul class="small">
				<li>Use high contrast colors for visibility</li>
				<li>Keep animations smooth but not distracting</li>
				<li>Consider dark mode compatibility</li>
				<li>Test with various content lengths</li>
			</ul>
		{/snippet}
	</ShowcaseSection>
</div>