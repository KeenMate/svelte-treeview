<script lang="ts" generics="T">
	import {type LTreeNode} from "../ltree/ltree-node.svelte.js"
	import Node from "./Node.svelte"
	import {getContext, onDestroy, type Snippet} from "svelte"
	import type {Ltree, DropPosition, DropOperation} from "../ltree/types.js"
	import type {RenderCoordinator} from "./RenderCoordinator.svelte.js"
	import type {NodeCallbacks, NodeConfig} from "../core/TreeController.svelte.js"
	import { uiLogger } from "../logger.js"

	// Define component props interface
	// Callbacks and config come from context, drag state comes as props
	interface Props {
		node: LTreeNode<T>;
		children?: Snippet<[T]>; // Keep the general children slot for backward compatibility

		// Progressive rendering
		progressiveRender?: boolean;
		renderBatchSize?: number;

		// Drag state (passed as props for efficient Svelte diffing)
		isDraggedNode?: boolean;
		isDragInProgress?: boolean;
		hoveredNodeForDropPath?: string | null;
		activeDropPosition?: DropPosition | null;
		dropOperation?: DropOperation;

		// Flat rendering mode
		flatMode?: boolean; // When true, don't render children (Tree handles flat rendering)
		flatIndentSize?: string; // CSS value for per-level indentation in flat mode
	}

	// Destructure props using Svelte 5 syntax
	let {
		node,
		children = undefined,

		// Progressive rendering
		progressiveRender = false,
		renderBatchSize = 50,

		// Drag state
		isDraggedNode = false,
		isDragInProgress = false,
		hoveredNodeForDropPath = null,
		activeDropPosition = null,
		dropOperation = 'move',

		// Flat rendering mode
		flatMode = false,
		flatIndentSize = '1.5rem',
	}: Props = $props()

	// Get stable references from context (avoids prop drilling and re-renders from inline functions)
	const callbacks = getContext<NodeCallbacks<T>>('NodeCallbacks');
	const config = getContext<NodeConfig>('NodeConfig');

	// Destructure config for convenience (these are stable references)
	const {
		shouldToggleOnNodeClick,
		expandIconClass,
		collapseIconClass,
		leafIconClass,
		selectedNodeClass,
		dragOverNodeClass,
		dropZoneMode,
		dropZoneLayout,
		dropZoneStart,
		dropZoneMaxWidth,
		allowCopy,
	} = config;

	// Compute if THIS node is the one being hovered for drop
	const isHoveredForDrop = $derived(hoveredNodeForDropPath === node.path);

	// Format dropZoneStart - number = percentage, string = as-is
	const formattedDropZoneStart = $derived(
		typeof dropZoneStart === 'number' ? `${dropZoneStart}%` : dropZoneStart
	)

	const tree = getContext<Ltree<T>>("Ltree")
	const renderCoordinator = getContext<RenderCoordinator | null>("RenderCoordinator")

	// Drag over state
	let isDraggedOver = $state(false);

	// Track which drop zone is being hovered during drag (for floating mode)
	let hoveredZone = $state<'before' | 'after' | 'child' | null>(null);

	// Track glow position for glow mode
	let glowPosition = $state<'before' | 'after' | 'child' | null>(null);

	// Get allowed drop positions for this node (empty/undefined = all allowed)
	// Uses tree.getNodeAllowedDropPositions which checks callback > member > node property
	const allowedPositions = $derived(tree.getNodeAllowedDropPositions(node));

	// Check if a position is allowed for this node
	function isPositionAllowed(position: DropPosition): boolean {
		if (!allowedPositions || allowedPositions.length === 0) {
			return true; // All positions allowed by default
		}
		return allowedPositions.includes(position);
	}

	// Calculate glow position based on mouse position in the node row
	// Respects allowedDropPositions - snaps to nearest allowed position
	function calculateGlowPosition(event: DragEvent, element: HTMLElement): 'before' | 'after' | 'child' | null {
		const rect = element.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const width = rect.width;
		const height = rect.height;

		// Calculate the ideal position based on mouse position
		let idealPosition: DropPosition;
		if (x > width / 2) {
			idealPosition = 'child';
		} else if (y < height / 2) {
			idealPosition = 'before';
		} else {
			idealPosition = 'after';
		}

		// If no restrictions, return the ideal position
		if (!allowedPositions || allowedPositions.length === 0) {
			return idealPosition;
		}

		// If the ideal position is allowed, use it
		if (allowedPositions.includes(idealPosition)) {
			return idealPosition;
		}

		// Otherwise, snap to the nearest allowed position
		// Priority: if only one position allowed, use that
		if (allowedPositions.length === 1) {
			return allowedPositions[0];
		}

		// Multiple positions allowed but not the ideal one
		// For before/after: pick based on Y position
		// For child: pick based on what's available
		if (allowedPositions.includes('before') && allowedPositions.includes('after')) {
			// Both before and after allowed, pick based on Y
			return y < height / 2 ? 'before' : 'after';
		}

		// Return the first allowed position
		return allowedPositions[0];
	}

	// Convert reactive statements to derived values
	// In flat mode, children rendering is handled by Tree.svelte, so we skip these computations
	const childrenArray = $derived(!flatMode ? Object.values(node?.children || []) : [])
	const hasChildren = $derived(node?.hasChildren || false)
	const indentStyle = $derived(
		flatMode
			? `margin-left: calc(${(node?.level || 1) - 1} * ${flatIndentSize})`
			: `margin-left: var(--tree-node-indent-per-level, 0.5rem)`,
	)

	// Progressive rendering state - only used in recursive mode
	let renderedCount = $state(0);
	let unregisterFromCoordinator: (() => void) | null = null;
	let lastExpandedState = false;
	let lastChildrenLength = 0;

	// Get the children to render (all or progressive slice) - only used in recursive mode
	const childrenToRender = $derived(
		!flatMode && progressiveRender && renderCoordinator
			? childrenArray.slice(0, renderedCount)
			: childrenArray
	);
	const hasMoreToRender = $derived(
		!flatMode && progressiveRender && renderCoordinator && renderedCount < childrenArray.length
	);

	// Handle expansion state changes - use coordinator for progressive rendering
	// Skip entirely in flat mode since Tree.svelte handles children rendering
	$effect(() => {
		if (flatMode) return; // Skip in flat mode - children handled by Tree

		const isExpanded = node?.isExpanded ?? false;
		const childCount = childrenArray.length;
		const shouldRenderProgressively = progressiveRender && renderCoordinator && childCount > 0;

		// Only act on actual state changes
		if (isExpanded !== lastExpandedState || childCount !== lastChildrenLength) {
			lastExpandedState = isExpanded;
			lastChildrenLength = childCount;

			if (isExpanded && shouldRenderProgressively) {
				// Clean up any existing registration first
				if (unregisterFromCoordinator) {
					unregisterFromCoordinator();
					unregisterFromCoordinator = null;
				}

				// If this node was already fully rendered (component recreated after changeTracker update),
				// render all children immediately instead of progressive rendering
				if (renderCoordinator.isCompleted(node.path)) {
					renderedCount = childCount;
					return;
				}

				// Start with first batch immediately
				renderedCount = Math.min(renderBatchSize, childCount);

				// Register with coordinator if there are more children to render
				if (renderedCount < childCount) {
					unregisterFromCoordinator = renderCoordinator.register(node.path, () => {
						// Render a batch of children per callback invocation
						if (renderedCount < childCount) {
							renderedCount = Math.min(renderedCount + renderBatchSize, childCount);
							return renderedCount < childCount; // Return true if more work needed
						}
						return false;
					});
				}
			} else if (!isExpanded) {
				// Clean up when collapsed
				if (unregisterFromCoordinator) {
					unregisterFromCoordinator();
					unregisterFromCoordinator = null;
				}
				renderedCount = 0;
			}
		}
	});

	// Clean up on component destroy
	onDestroy(() => {
		if (unregisterFromCoordinator) {
			unregisterFromCoordinator();
			unregisterFromCoordinator = null;
		}
	});

	function toggleExpanded() {
		if (node.hasChildren) {
			const newState = !node.isExpanded
			uiLogger.debug(`${newState ? 'Expanding' : 'Collapsing'} node: ${node.path}`)
			node.isExpanded = newState
			tree.refresh()
		}
	}

	function _onNodeClicked() {
		uiLogger.debug(`Node clicked: ${node.path}`, { id: node.id, hasChildren: node.hasChildren })
		callbacks.onNodeClicked(node)
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
			class:ltree-glow-before={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'before' && isPositionAllowed('before')}
			class:ltree-glow-after={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'after' && isPositionAllowed('after')}
			class:ltree-glow-child={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'child' && isPositionAllowed('child')}
			class:ltree-drop-copy={isDragInProgress && isHoveredForDrop && dropOperation === 'copy'}
			draggable={node?.isDraggable}
			onclick={(e) => {
				e.stopPropagation();
				_onNodeClicked();
			}}
			oncontextmenu={(e) => {
				e.stopPropagation();
				callbacks.onNodeRightClicked(node, e);
			}}
			ondragstart={(e) => {
				if (node?.isDraggable && e.dataTransfer) {
					e.dataTransfer.effectAllowed = allowCopy ? "copyMove" : "move";
					e.dataTransfer.setData(
						"application/svelte-treeview",
						JSON.stringify(node),
					);
					callbacks.onNodeDragStart(node, e);
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
				callbacks.onNodeDragOver(node, e);
			}}
			ondragleave={(e) => {
				const rect = e.currentTarget.getBoundingClientRect();
				const x = e.clientX;
				const y = e.clientY;

				if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
					isDraggedOver = false;
					glowPosition = null;
					callbacks.onNodeDragLeave(node, e);
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
					callbacks.onZoneDrop(node, glowPosition, e);
				} else {
					callbacks.onNodeDrop(node, e);
				}
				glowPosition = null;
			}}
			ontouchstart={(e) => callbacks.onTouchDragStart(node, e)}
			ontouchmove={(e) => callbacks.onTouchDragMove(node, e)}
			ontouchend={(e) => callbacks.onTouchDragEnd(node, e)}
		>
			{#if children}
				{@render children(node)}
			{:else}
				{tree.getNodeDisplayValue(node)}
			{/if}
		</div>

		<!-- Drop zones: positioned relative to .ltree-node-row (outside content to avoid padding issues) -->
		<!-- Only render floating drop zones when in 'floating' mode, filtered by allowedDropPositions -->
		{#if dropZoneMode === 'floating' && isDragInProgress && isHoveredForDrop}
			<div
				class="ltree-drop-zones ltree-drop-zones-{dropZoneLayout}"
				style="--drop-zone-start: {formattedDropZoneStart}; --drop-zone-max-width: {dropZoneMaxWidth}px;"
			>
				{#if isPositionAllowed('before')}
					<div
						class="ltree-drop-zone ltree-drop-before"
						class:ltree-drop-zone-active={hoveredZone === 'before'}
						ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = 'before'; callbacks.onNodeDragOver(node, e); }}
						ondragleave={() => { hoveredZone = null; }}
						ondrop={(e) => { e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = null; callbacks.onZoneDrop(node, 'before', e); }}
					>↑ Before</div>
				{/if}
				{#if isPositionAllowed('after')}
					<div
						class="ltree-drop-zone ltree-drop-after"
						class:ltree-drop-zone-active={hoveredZone === 'after'}
						ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = 'after'; callbacks.onNodeDragOver(node, e); }}
						ondragleave={() => { hoveredZone = null; }}
						ondrop={(e) => { e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = null; callbacks.onZoneDrop(node, 'after', e); }}
					>↓ After</div>
				{/if}
				{#if isPositionAllowed('child')}
					<div
						class="ltree-drop-zone ltree-drop-child"
						class:ltree-drop-zone-active={hoveredZone === 'child'}
						ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = 'child'; callbacks.onNodeDragOver(node, e); }}
						ondragleave={() => { hoveredZone = null; }}
						ondrop={(e) => { e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = (allowCopy && e.ctrlKey) ? 'copy' : 'move'; hoveredZone = null; callbacks.onZoneDrop(node, 'child', e); }}
					>→ Child</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- In flat mode, children are rendered by Tree.svelte, not recursively here -->
	{#if !flatMode && node?.isExpanded && node?.hasChildren}
		<div class="ltree-children">
			{#each childrenToRender as item (item.id)}
				<Node
					node={item}
					{children}
					{progressiveRender}
					{renderBatchSize}
					{isDraggedNode}
					{isDragInProgress}
					{hoveredNodeForDropPath}
					{activeDropPosition}
					{dropOperation}
				/>
			{/each}
			{#if hasMoreToRender}
				<div class="ltree-loading-more">
					Loading... ({renderedCount}/{childrenArray.length})
				</div>
			{/if}
		</div>
	{/if}
</div>
