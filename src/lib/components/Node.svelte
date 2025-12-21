<script lang="ts" generics="T">
	import {type LTreeNode} from "../ltree/ltree-node.svelte.js"
	import Node from "./Node.svelte"
	import {getContext, type Snippet} from "svelte"
	import type {Ltree, DropPosition, DropOperation} from "../ltree/types.js"

	// Define component props interface
	interface Props {
		node: LTreeNode<T>;
		children?: Snippet<[T]>; // Keep the general children slot for backward compatibility
		onNodeClicked?: (node: LTreeNode<T>) => void;
		onNodeRightClicked?: (node: LTreeNode<T>, event: MouseEvent) => void;
		onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDragLeave?: (node: LTreeNode<T>, event: DragEvent) => void;
		onNodeDrop?: (node: LTreeNode<T>, event: DragEvent) => void;
		onZoneDrop?: (node: LTreeNode<T>, position: DropPosition, event: DragEvent) => void;

		// Touch drag handlers for mobile support
		onTouchDragStart?: (node: LTreeNode<T>, event: TouchEvent) => void;
		onTouchDragMove?: (node: LTreeNode<T>, event: TouchEvent) => void;
		onTouchDragEnd?: (node: LTreeNode<T>, event: TouchEvent) => void;

		// BEHAVIOUR
		shouldToggleOnNodeClick?: boolean | null | undefined;

		// VISUALS
		expandIconClass?: string | null | undefined;
		collapseIconClass?: string | null | undefined;
		leafIconClass?: string | null | undefined;
		selectedNodeClass?: string | null | undefined;
		dragOverNodeClass?: string | null | undefined;
		isDraggedNode?: boolean | null | undefined;

		// Drag position indicators
		isDragInProgress?: boolean;
		hoveredNodeForDropPath?: string | null; // Path of node being hovered for drop
		activeDropPosition?: DropPosition | null;

		// Drop zone configuration
		dropZoneMode?: 'floating' | 'glow'; // 'floating' = original floating zones, 'glow' = border glow indicators
		dropZoneLayout?: 'around' | 'above' | 'below' | 'wave' | 'wave2';
		dropZoneStart?: number | string; // number = percentage (0-100), string = any CSS value ("33%", "50px", "3rem")
		dropZoneMaxWidth?: number; // max width in pixels for wave layouts
		dropOperation?: DropOperation; // Current drag operation ('move' or 'copy')
		allowCopy?: boolean; // Whether copy operation is allowed (Ctrl+drag)
	}

	// Destructure props using Svelte 5 syntax
	let {
		node,
		children = undefined,
		onNodeClicked,
		onNodeRightClicked,
		onNodeDragStart,
		onNodeDragOver,
		onNodeDragLeave,
		onNodeDrop,
		onZoneDrop,

		// Touch drag handlers for mobile support
		onTouchDragStart,
		onTouchDragMove,
		onTouchDragEnd,

		// BEHAVIOUR
		shouldToggleOnNodeClick = true,

		// VISUALS
		expandIconClass = "ltree-icon-expand",
		collapseIconClass = "ltree-icon-collapse",
		leafIconClass = "ltree-icon-leaf",
		selectedNodeClass,
		dragOverNodeClass,
		isDraggedNode = false,

		// Drag position indicators
		isDragInProgress = false,
		hoveredNodeForDropPath = null,
		activeDropPosition = null,

		// Drop zone configuration
		dropZoneMode = 'glow',
		dropZoneLayout = 'around',
		dropZoneStart = 33,
		dropZoneMaxWidth = 120,
		dropOperation = 'move',
		allowCopy = false,
	}: Props = $props()

	// Compute if THIS node is the one being hovered for drop
	const isHoveredForDrop = $derived(hoveredNodeForDropPath === node.path)

	// Format dropZoneStart - number = percentage, string = as-is
	const formattedDropZoneStart = $derived(
		typeof dropZoneStart === 'number' ? `${dropZoneStart}%` : dropZoneStart
	)

	const tree = getContext<Ltree<T>>("Ltree")

	// Drag over state
	let isDraggedOver = $state(false);

	// Track which drop zone is being hovered during drag (for floating mode)
	let hoveredZone = $state<'above' | 'below' | 'child' | null>(null);

	// Track glow position for glow mode
	let glowPosition = $state<'above' | 'below' | 'child' | null>(null);

	// Calculate glow position based on mouse position in the node row
	function calculateGlowPosition(event: DragEvent, element: HTMLElement): 'above' | 'below' | 'child' {
		const rect = element.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const width = rect.width;
		const height = rect.height;

		// Right half = child
		if (x > width / 2) {
			return 'child';
		}
		// Left half, top 50% = above
		if (y < height / 2) {
			return 'above';
		}
		// Left half, bottom 50% = below
		return 'below';
	}

	// Convert reactive statements to derived values
	const childrenWithData = $derived(Object.values(node?.children || []))
	const hasChildren = $derived(node?.hasChildren || false)
	const indentStyle = $derived(
		`margin-left: var(--tree-node-indent-per-level, 0.5rem)`,
	)

	function toggleExpanded() {
		if (node.hasChildren) {
			node.isExpanded = !node.isExpanded
			tree.refresh()
		}
	}

	function _onNodeClicked() {
		onNodeClicked?.(node)
		if (shouldToggleOnNodeClick) {
			toggleExpanded()
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="ltree-node"
	id="{node.treeId}-{node.id}"
	data-tree-path="{node.path}"
	style={indentStyle}
>
	<div class="ltree-node-row">
		<!-- Toggle icon with its own click handler -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		{#if hasChildren}
			<span
				class="ltree-toggle-icon ltree-clickable {node.isExpanded
					? collapseIconClass
					: expandIconClass}"
				class:expanded={node.isExpanded}
				onclick={toggleExpanded}
			></span>
		{:else}
			<span class="ltree-toggle-icon {leafIconClass}"></span>
		{/if}

		<!-- Node content with separate click handler -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="ltree-node-content {node.isSelected ? selectedNodeClass : ''} {isDraggedOver && dragOverNodeClass ? dragOverNodeClass : ''}"
			class:ltree-clickable={node.isSelectable}
			class:ltree-dragged={isDraggedNode}
			class:ltree-draggable={node?.isDraggable}
			class:ltree-glow-above={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'above'}
			class:ltree-glow-below={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'below'}
			class:ltree-glow-child={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'child'}
			class:ltree-drop-copy={isDragInProgress && isHoveredForDrop && dropOperation === 'copy'}
			draggable={node?.isDraggable}
			onclick={(e) => {
				e.stopPropagation();
				_onNodeClicked();
			}}
			oncontextmenu={(e) => {
				e.stopPropagation();
				onNodeRightClicked?.(node, e);
			}}
			ondragstart={(e) => {
				if (node?.isDraggable && e.dataTransfer) {
					e.dataTransfer.effectAllowed = allowCopy ? "copyMove" : "move";
					e.dataTransfer.setData(
						"application/svelte-treeview",
						JSON.stringify(node),
					);
					onNodeDragStart?.(node, e);
				}
			}}
			ondragover={(e) => {
				if (e.dataTransfer?.types.includes("application/svelte-treeview")) {
					e.preventDefault();
					// Set dropEffect directly from event to avoid timing issues with prop updates
					if (e.dataTransfer) {
						e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move';
					}
					isDraggedOver = true;
					// In glow mode, calculate and update the glow position
					if (dropZoneMode === 'glow') {
						glowPosition = calculateGlowPosition(e, e.currentTarget as HTMLElement);
					}
				}
				onNodeDragOver?.(node, e);
			}}
			ondragleave={(e) => {
				const rect = e.currentTarget.getBoundingClientRect();
				const x = e.clientX;
				const y = e.clientY;

				if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
					isDraggedOver = false;
					glowPosition = null;
					onNodeDragLeave?.(node, e);
				}
			}}
			ondrop={(e) => {
				e.stopPropagation();
				// Confirm dropEffect for spec compliance
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move';
				}
				isDraggedOver = false;
				// In glow mode, use the calculated glowPosition for the drop
				if (dropZoneMode === 'glow' && glowPosition) {
					onZoneDrop?.(node, glowPosition, e);
				} else {
					onNodeDrop?.(node, e);
				}
				glowPosition = null;
			}}
			ontouchstart={(e) => onTouchDragStart?.(node, e)}
			ontouchmove={(e) => onTouchDragMove?.(node, e)}
			ontouchend={(e) => onTouchDragEnd?.(node, e)}
		>
			{#if children}
				{@render children(node)}
			{:else}
				{tree.getNodeDisplayValue(node)}
			{/if}
		</div>

		<!-- Drop zones: positioned relative to .ltree-node-row (outside content to avoid padding issues) -->
		<!-- Only render floating drop zones when in 'floating' mode -->
		{#if dropZoneMode === 'floating' && isDragInProgress && isHoveredForDrop}
			<div
				class="ltree-drop-zones ltree-drop-zones-{dropZoneLayout}"
				style="--drop-zone-start: {formattedDropZoneStart}; --drop-zone-max-width: {dropZoneMaxWidth}px;"
			>
				<div
					class="ltree-drop-zone ltree-drop-above"
					class:ltree-drop-zone-active={hoveredZone === 'above'}
					ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = 'above'; onNodeDragOver?.(node, e); }}
					ondragleave={() => { hoveredZone = null; }}
					ondrop={(e) => { e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = null; onZoneDrop?.(node, 'above', e); }}
				>↑ Above</div>
				<div
					class="ltree-drop-zone ltree-drop-below"
					class:ltree-drop-zone-active={hoveredZone === 'below'}
					ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = 'below'; onNodeDragOver?.(node, e); }}
					ondragleave={() => { hoveredZone = null; }}
					ondrop={(e) => { e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = null; onZoneDrop?.(node, 'below', e); }}
				>↓ Below</div>
				<div
					class="ltree-drop-zone ltree-drop-child"
					class:ltree-drop-zone-active={hoveredZone === 'child'}
					ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = 'child'; onNodeDragOver?.(node, e); }}
					ondragleave={() => { hoveredZone = null; }}
					ondrop={(e) => { e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = null; onZoneDrop?.(node, 'child', e); }}
				>→ Child</div>
			</div>
		{/if}
	</div>

	{#if node?.isExpanded && node?.hasChildren}
		<div class="ltree-children">
			{#each Object.values(node?.children) as item (item.id)}
				<Node
					node={item}
					{children}
					{shouldToggleOnNodeClick}
					{onNodeClicked}
					{onNodeRightClicked}
					{onNodeDragStart}
					{onNodeDragOver}
					{onNodeDragLeave}
					{onNodeDrop}
					{onZoneDrop}
					{onTouchDragStart}
					{onTouchDragMove}
					{onTouchDragEnd}
					{expandIconClass}
					{collapseIconClass}
					{leafIconClass}
					{selectedNodeClass}
					{dragOverNodeClass}
					{isDraggedNode}
					{isDragInProgress}
					{hoveredNodeForDropPath}
					{activeDropPosition}
					{dropZoneMode}
					{dropZoneLayout}
					{dropZoneStart}
					{dropZoneMaxWidth}
					{dropOperation}
					{allowCopy}
				/>
			{/each}
		</div>
	{/if}
</div>
