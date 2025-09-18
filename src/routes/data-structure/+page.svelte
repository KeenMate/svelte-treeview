<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';

	// Example 1: Minimal ltree path-based data
	const minimalData = [
		{ id: '1', path: '1', name: 'Documents' },
		{ id: '1.1', path: '1.1', name: 'Projects' },
		{ id: '1.1.1', path: '1.1.1', name: 'Website Redesign' },
		{ id: '1.1.2', path: '1.1.2', name: 'Mobile App' },
		{ id: '1.2', path: '1.2', name: 'Reports' },
		{ id: '2', path: '2', name: 'Media Assets' },
		{ id: '2.1', path: '2.1', name: 'Images' },
		{ id: '2.1.1', path: '2.1.1', name: 'Logo Files' }
	];

	// Example 2: Optimized data with precomputed values
	const optimizedData = [
		{ id: '1', path: '1', parentPath: '', level: 1, hasChildren: true, isExpanded: true, name: 'Root Folder', type: 'folder' },
		{ id: '1.1', path: '1.1', parentPath: '1', level: 2, hasChildren: true, isExpanded: false, name: 'Subdirectory A', type: 'folder' },
		{ id: '1.1.1', path: '1.1.1', parentPath: '1.1', level: 3, hasChildren: false, isExpanded: false, name: 'File A1.txt', type: 'file' },
		{ id: '1.1.2', path: '1.1.2', parentPath: '1.1', level: 3, hasChildren: false, isExpanded: false, name: 'File A2.pdf', type: 'file' },
		{ id: '1.2', path: '1.2', parentPath: '1', level: 2, hasChildren: true, isExpanded: true, name: 'Subdirectory B', type: 'folder' },
		{ id: '1.2.1', path: '1.2.1', parentPath: '1.2', level: 3, hasChildren: false, isExpanded: false, name: 'File B1.doc', type: 'file' },
		{ id: '2', path: '2', parentPath: '', level: 1, hasChildren: false, isExpanded: false, name: 'Another Root File.txt', type: 'file' }
	];

	// Example 3: External search data management
	const searchableData = [
		{ id: '1', path: '1', name: 'Development Projects', description: 'Software development and coding projects', tags: ['dev', 'code', 'software'] },
		{ id: '1.1', path: '1.1', name: 'Web Applications', description: 'Frontend and backend web development', tags: ['web', 'frontend', 'backend'] },
		{ id: '1.1.1', path: '1.1.1', name: 'E-commerce Platform', description: 'Online shopping cart and payment system', tags: ['ecommerce', 'shopping', 'payments'] },
		{ id: '1.1.2', path: '1.1.2', name: 'Blog CMS', description: 'Content management system for blogging', tags: ['cms', 'blog', 'content'] },
		{ id: '1.2', path: '1.2', name: 'Mobile Apps', description: 'iOS and Android mobile applications', tags: ['mobile', 'ios', 'android'] },
		{ id: '1.2.1', path: '1.2.1', name: 'Fitness Tracker', description: 'Health and fitness monitoring app', tags: ['health', 'fitness', 'tracking'] },
		{ id: '2', path: '2', name: 'Design Assets', description: 'UI/UX design files and resources', tags: ['design', 'ui', 'ux'] },
		{ id: '2.1', path: '2.1', name: 'Mockups', description: 'User interface design mockups', tags: ['mockup', 'wireframe', 'prototype'] }
	];

	// External search implementation
	let externalSearchQuery = $state('');
	let filteredExternalData = $state(searchableData);

	function performExternalSearch() {
		if (!externalSearchQuery.trim()) {
			filteredExternalData = searchableData;
			return;
		}

		const query = externalSearchQuery.toLowerCase();
		filteredExternalData = searchableData.filter(item =>
			item.name.toLowerCase().includes(query) ||
			item.description.toLowerCase().includes(query) ||
			item.tags.some(tag => tag.toLowerCase().includes(query))
		);
	}

	// Invalid data structure examples (for educational purposes)
	const invalidStructures = {
		traditional: [
			{ id: 1, parentId: null, name: 'Root' },      // ❌ Traditional parent ID structure
			{ id: 2, parentId: 1, name: 'Child' }
		],
		inconsistentPaths: [
			{ id: '1', path: '1', name: 'First' },
			{ id: '2', path: '1.1.1', name: 'Skip levels' }, // ❌ Missing '1.1' level
			{ id: '3', path: '2', name: 'Second' }
		]
	};

	// Example 4: Custom path separator data
	const customSeparatorData = [
		{ id: '1', path: '1', name: 'Root Directory', type: 'folder' },
		{ id: '1/src', path: '1/src', name: 'Source Code', type: 'folder' },
		{ id: '1/src/components', path: '1/src/components', name: 'Components', type: 'folder' },
		{ id: '1/src/components/TreeView.svelte', path: '1/src/components/TreeView.svelte', name: 'TreeView.svelte', type: 'file' },
		{ id: '1/src/utils', path: '1/src/utils', name: 'Utilities', type: 'folder' },
		{ id: '1/src/utils/helpers.ts', path: '1/src/utils/helpers.ts', name: 'helpers.ts', type: 'file' },
		{ id: '1/public', path: '1/public', name: 'Public Assets', type: 'folder' },
		{ id: '1/public/images', path: '1/public/images', name: 'Images', type: 'folder' }
	];

	// Sort callback
	const sortCallback = (items: any[]) => {
		return items.sort((a, b) => a.data.name.localeCompare(b.data.name));
	};
</script>

<h1>Data Structure & Management</h1>
<p class="lead">Understanding LTree path-based data structure, optimization techniques, and external data management.</p>

	<ShowcaseSection
		title="LTree Path Structure"
		subtitle="Understanding the path-based hierarchical data model">
		{#snippet demo()}
			<Tree
				data={minimalData}
				idMember="id"
				pathMember="path"
				displayValueMember="name"
				shouldDisplayDebugInformation={true}
				expandLevel={3}
				sortCallback={sortCallback}
			>
				{#snippet nodeTemplate(node)}
					<div class="d-flex align-items-center">
						<span class="me-2">
							{#if node.hasChildren}📁{:else}📄{/if}
						</span>
						<div>
							<div class="fw-semibold">{node.data.name}</div>
							<small class="text-muted">Path: {node.path} | Level: {node.level}</small>
						</div>
					</div>
				{/snippet}
			</Tree>
		{/snippet}

		{#snippet controls()}
			<div class="bg-light p-3 rounded">
				<h6>Minimal Data Structure:</h6>
				<pre><code>[
  &#123;
    "id": "1",
    "path": "1",
    "name": "Documents"
  &#125;,
  &#123;
    "id": "1.1",
    "path": "1.1",
    "name": "Projects"
  &#125;,
  &#123;
    "id": "1.1.1",
    "path": "1.1.1",
    "name": "Website Redesign"
  &#125;
]</code></pre>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>Path-Based Hierarchy</h6>
			<p>The component uses <strong>path-based structure</strong> similar to PostgreSQL's ltree extension:</p>
			<ul class="small">
				<li><code>"1"</code> - Root level node</li>
				<li><code>"1.1"</code> - First child of "1"</li>
				<li><code>"1.1.1"</code> - First child of "1.1"</li>
				<li><code>"2"</code> - Second root level node</li>
			</ul>

			<h6>Required Properties</h6>
			<ul class="small">
				<li><strong>idMember</strong>: Unique identifier for each node</li>
				<li><strong>pathMember</strong>: LTree path defining hierarchy</li>
				<li><strong>displayValueMember</strong>: Property to display as node text</li>
			</ul>

			<h6>Automatic Calculations</h6>
			<p>The component automatically calculates:</p>
			<ul class="small">
				<li>Parent-child relationships from paths</li>
				<li>Node levels (depth in hierarchy)</li>
				<li>hasChildren status</li>
				<li>Default expansion state</li>
			</ul>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection
		title="Optimized Data Structure"
		subtitle="Precomputed values for better performance">
		{#snippet demo()}
			<Tree
				data={optimizedData}
				idMember="id"
				pathMember="path"
				parentPathMember="parentPath"
				levelMember="level"
				hasChildrenMember="hasChildren"
				isExpandedMember="isExpanded"
				displayValueMember="name"
				shouldDisplayDebugInformation={true}
				sortCallback={sortCallback}
			>
				{#snippet nodeTemplate(node)}
					<div class="d-flex align-items-center">
						<span class="me-2">
							{#if node.data.type === 'folder'}📁{:else}📄{/if}
						</span>
						<div>
							<div class="fw-semibold">{node.data.name}</div>
							<small class="text-muted">
								Path: {node.path} |
								Level: {node.level} |
								Parent: {node.parentPath || 'root'} |
								Children: {node.hasChildren ? 'yes' : 'no'}
							</small>
						</div>
					</div>
				{/snippet}
			</Tree>
		{/snippet}

		{#snippet controls()}
			<div class="bg-light p-3 rounded">
				<h6>Optimized Data Structure:</h6>
				<pre><code>[
  &#123;
    "id": "1",
    "path": "1",
    "parentPath": "",
    "level": 1,
    "hasChildren": true,
    "isExpanded": true,
    "name": "Root Folder",
    "type": "folder"
  &#125;,
  &#123;
    "id": "1.1",
    "path": "1.1",
    "parentPath": "1",
    "level": 2,
    "hasChildren": true,
    "isExpanded": false,
    "name": "Subdirectory A",
    "type": "folder"
  &#125;
]</code></pre>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>Performance Optimization</h6>
			<p>Precompute values to avoid runtime calculations for large datasets:</p>

			<h6>Optional Precomputed Properties</h6>
			<ul class="small">
				<li><strong>parentPathMember</strong>: Direct parent path reference</li>
				<li><strong>levelMember</strong>: Numeric depth level (1, 2, 3...)</li>
				<li><strong>hasChildrenMember</strong>: Boolean indicating children existence</li>
				<li><strong>isExpandedMember</strong>: Default expansion state</li>
			</ul>

			<h6>Benefits</h6>
			<ul class="small">
				<li>Faster initial rendering with large datasets</li>
				<li>Reduced computation during tree building</li>
				<li>Custom expansion states per node</li>
				<li>Explicit parent-child relationships</li>
			</ul>

			<h6>When to Use</h6>
			<p>Use precomputed values when you have:</p>
			<ul class="small">
				<li>Large datasets (1000+ nodes)</li>
				<li>Frequent data updates</li>
				<li>Complex expansion logic</li>
				<li>Server-side data preprocessing</li>
			</ul>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection
		title="Custom Path Separators"
		subtitle="Using different separators for hierarchical paths">
		{#snippet demo()}
			<Tree
				data={customSeparatorData}
				idMember="id"
				pathMember="path"
				displayValueMember="name"
				treePathSeparator="/"
				shouldDisplayDebugInformation={true}
				expandLevel={2}
				sortCallback={sortCallback}
			>
				{#snippet nodeTemplate(node)}
					<div class="d-flex align-items-center">
						<span class="me-2">
							{#if node.data.type === 'folder'}📁{:else}📄{/if}
						</span>
						<div>
							<div class="fw-semibold">{node.data.name}</div>
							<small class="text-muted">Path: {node.path} | Separator: "/"</small>
						</div>
					</div>
				{/snippet}
			</Tree>
		{/snippet}

		{#snippet controls()}
			<div class="bg-light p-3 rounded">
				<h6>Custom Separator Data:</h6>
				<pre><code>[
  &#123; id: '1', path: '1', name: 'Root Directory' &#125;,
  &#123; id: '1/src', path: '1/src', name: 'Source Code' &#125;,
  &#123; id: '1/src/components', path: '1/src/components', name: 'Components' &#125;,
  &#123; id: '1/src/components/TreeView.svelte', path: '1/src/components/TreeView.svelte', name: 'TreeView.svelte' &#125;
]</code></pre>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>Custom Path Separators</h6>
			<p>The <code>treePathSeparator</code> prop allows you to use different separators for hierarchical paths:</p>

			<h6>Usage Examples</h6>
			<pre><code>&lt;Tree
  data=&#123;data&#125;
  pathMember="path"
  treePathSeparator="/"  &lt;!-- Use forward slash --&gt;
/&gt;

&lt;Tree
  data=&#123;data&#125;
  pathMember="path"
  treePathSeparator="|"  &lt;!-- Use pipe character --&gt;
/&gt;</code></pre>

			<h6>Common Separators</h6>
			<ul class="small">
				<li><strong>"." (default)</strong>: Traditional ltree style - "1.2.3"</li>
				<li><strong>"/"</strong>: File system style - "1/2/3"</li>
				<li><strong>"|"</strong>: Pipe delimited - "1|2|3"</li>
				<li><strong>"-"</strong>: Dash separated - "1-2-3"</li>
			</ul>

			<h6>Benefits</h6>
			<ul class="small">
				<li>Match existing data structure conventions</li>
				<li>Better readability for specific use cases</li>
				<li>Integration with file system paths</li>
				<li>Compatibility with legacy systems</li>
			</ul>

			<h6>Important Notes</h6>
			<ul class="small">
				<li>Separator must be consistent across all paths</li>
				<li>Choose separators that don't conflict with data content</li>
				<li>All path operations respect the custom separator</li>
			</ul>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection
		title="External Search & Data Management"
		subtitle="Managing search outside of the tree component">
		{#snippet demo()}
			<div class="mb-3">
				<div class="input-group">
					<input
						type="text"
						class="form-control"
						placeholder="Search externally..."
						bind:value={externalSearchQuery}
						oninput={performExternalSearch}
					/>
					<button class="btn btn-outline-secondary" onclick={() => { externalSearchQuery = ''; performExternalSearch(); }}>
						Clear
					</button>
				</div>
				{#if externalSearchQuery}
					<small class="text-muted">
						Showing {filteredExternalData.length} of {searchableData.length} items
					</small>
				{/if}
			</div>

			<Tree
				data={filteredExternalData}
				idMember="id"
				pathMember="path"
				displayValueMember="name"
				shouldUseInternalSearchIndex={false}
				expandLevel={2}
				sortCallback={sortCallback}
			>
				{#snippet nodeTemplate(node)}
					<div class="d-flex align-items-start">
						<span class="me-2">
							{#if node.hasChildren}📁{:else}💼{/if}
						</span>
						<div>
							<div class="fw-semibold">{node.data.name}</div>
							<p class="mb-1 small text-muted">{node.data.description}</p>
							<div class="d-flex gap-1">
								{#each node.data.tags as tag}
									<span class="badge bg-light text-dark">{tag}</span>
								{/each}
							</div>
						</div>
					</div>
				{/snippet}
			</Tree>
		{/snippet}

		{#snippet controls()}
			<div class="alert alert-info">
				<strong>Try searching for:</strong><br>
				<div class="small">
					• "web" (matches tags and descriptions)<br>
					• "fitness" (specific project)<br>
					• "design" (category)<br>
					• "cms" (technical term)
				</div>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>External Data Management</h6>
			<p>When you don't want to use the internal search index, you can:</p>
			<ul class="small">
				<li>Filter data externally using your own logic</li>
				<li>Reassign the Tree's <code>data</code> property</li>
				<li>Implement custom search algorithms</li>
				<li>Integrate with external search services</li>
			</ul>

			<h6>Implementation Pattern</h6>
			<pre><code>// External filtering
let filteredData = originalData.filter(item =>
  item.name.includes(searchQuery) ||
  item.tags.some(tag => tag.includes(searchQuery))
);

// Reassign to tree
&lt;Tree data=&#123;filteredData&#125; .../&gt;</code></pre>

			<h6>Advantages</h6>
			<ul class="small">
				<li>Full control over search logic</li>
				<li>Integration with external APIs</li>
				<li>Custom filtering algorithms</li>
				<li>No dependency on FlexSearch</li>
			</ul>

			<h6>Disadvantages</h6>
			<ul class="small">
				<li>Manual implementation required</li>
				<li>No built-in fuzzy matching</li>
				<li>Tree rebuilds on each filter</li>
			</ul>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection
		title="Invalid Data Structures"
		subtitle="What NOT to do - common mistakes and unsupported patterns">
		{#snippet demo()}
			<div class="alert alert-danger">
				<h6>❌ Unsupported: Traditional Parent ID Structure</h6>
				<pre><code>[
  &#123; "id": 1, "parentId": null, "name": "Root" &#125;,
  &#123; "id": 2, "parentId": 1, "name": "Child" &#125;
]</code></pre>
				<p class="mb-0 small">The component does NOT support traditional ID/parentID relationships.</p>
			</div>

			<div class="alert alert-warning">
				<h6>⚠️ Invalid: Inconsistent Path Hierarchy</h6>
				<pre><code>[
  &#123; "id": "1", "path": "1", "name": "First" &#125;,
  &#123; "id": "2", "path": "1.1.1", "name": "Skip levels" &#125;,
  &#123; "id": "3", "path": "2", "name": "Second" &#125;
]</code></pre>
				<p class="mb-0 small">Missing intermediate levels will cause rendering issues.</p>
			</div>
		{/snippet}

		{#snippet controls()}
			<div class="bg-light p-3 rounded">
				<h6>✅ Correct Path Structure:</h6>
				<pre><code>[
  &#123; id: '1', path: '1', name: 'Level 1' &#125;,
  &#123; id: '1.1', path: '1.1', name: 'Level 2' &#125;,
  &#123; id: '1.1.1', path: '1.1.1', name: 'Level 3' &#125;
]</code></pre>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>Why LTree Paths Only?</h6>
			<p>The component is specifically designed for PostgreSQL ltree-style hierarchical data:</p>
			<ul class="small">
				<li>Efficient path-based operations</li>
				<li>Natural hierarchical sorting</li>
				<li>Fast ancestor/descendant queries</li>
				<li>Scalable with large hierarchies</li>
			</ul>

			<h6>Converting from Traditional Structure</h6>
			<p>If you have ID/parentID data, convert it before using:</p>
			<pre><code>function convertToLTree(traditionalData) &#123;
  // Build path hierarchy from parent relationships
  // This is a one-time conversion process
  return traditionalData.map(item => (&#123;
    ...item,
    path: buildPathFromParents(item, traditionalData)
  &#125;));
&#125;</code></pre>

			<h6>Path Requirements</h6>
			<ul class="small">
				<li>Use consistent separator (default: "." for "1.2.3", configurable via <code>treePathSeparator</code>)</li>
				<li>All intermediate levels must exist</li>
				<li>Paths should be sortable strings</li>
				<li>No gaps in hierarchy levels</li>
			</ul>
		{/snippet}
	</ShowcaseSection>