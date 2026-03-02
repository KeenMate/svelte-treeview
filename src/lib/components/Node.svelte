<script lang="ts" generics="T">
	import {type LTreeNode} from "../ltree/ltree-node.svelte.js"
	import Node from "./Node.svelte"
	import {getContext, onDestroy, type Snippet} from "svelte"
	import type {Ltree, DropPosition, DropOperation} from "../ltree/types.js"
	import type {RenderCoordinator} from "./RenderCoordinator.svelte.js"
	import type {NodeCallbacks, NodeConfig} from "./Tree.svelte"
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
		flatGap?: boolean; // When true in flat mode, add margin-top to match recursive .ltree-children gap
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
		flatGap = false,
	}: Props = $props()

	// Get stable references from context (avoids prop drilling and re-renders from inline functions)
	const callbacks = getContext<NodeCallbacks<T>>('NodeCallbacks');
	const config = getContext<NodeConfig>('NodeConfig');

	// Use $derived so values track mutations on the shared config proxy
	const shouldToggleOnNodeClick = $derived(config.shouldToggleOnNodeClick);
	const expandIconClass = $derived(config.expandIconClass);
	const collapseIconClass = $derived(config.collapseIconClass);
	const leafIconClass = $derived(config.leafIconClass);
	const selectedNodeClass = $derived(config.selectedNodeClass);
	const dragOverNodeClass = $derived(config.dragOverNodeClass);
	const dragDropMode = $derived(config.dragDropMode);
	const dropZoneMode = $derived(config.dropZoneMode);
	const dropZoneStart = $derived(config.dropZoneStart);
	const allowCopy = $derived(config.allowCopy);

	// Compute if THIS node is the one being hovered for drop
	const isHoveredForDrop = $derived(hoveredNodeForDropPath === node.path);

	const tree = getContext<Ltree<T>>("Ltree")
	const renderCoordinator = getContext<RenderCoordinator | null>("RenderCoordinator")

	// Per-node reactive signal — each NodeSignal has its own $state, so
	// bumping one signal only re-renders THIS Node, not all siblings.
	const nodeSignal = tree.getNodeSignal(String(node.id));
	const nodeRev = $derived(nodeSignal?.value ?? 0);

	// Drag over state
	let isDraggedOver = $state(false);

	// Track glow position for glow mode
	let glowPosition = $state<'above' | 'below' | 'child' | null>(null);

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
	function calculateGlowPosition(event: DragEvent, element: HTMLElement): 'above' | 'below' | 'child' | null {
		const rect = element.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const width = rect.width;
		const height = rect.height;

		// Calculate the ideal position based on mouse position
		let idealPosition: DropPosition;
		// Convert dropZoneStart to pixels: number = percentage, string = as-is (px or %)
		const startPx = typeof dropZoneStart === 'number'
			? (dropZoneStart / 100) * width
			: dropZoneStart.endsWith('px')
				? parseFloat(dropZoneStart)
				: (parseFloat(dropZoneStart) / 100) * width;

		if (x > startPx) {
			idealPosition = 'child';
		} else if (y < height / 2) {
			idealPosition = 'above';
		} else {
			idealPosition = 'below';
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
		// For above/below: pick based on Y position
		// For child: pick based on what's available
		if (allowedPositions.includes('above') && allowedPositions.includes('below')) {
			// Both above and below allowed, pick based on Y
			return y < height / 2 ? 'above' : 'below';
		}

		// Return the first allowed position
		return allowedPositions[0];
	}

	// Convert reactive statements to derived values
	// In flat mode, children rendering is handled by Tree.svelte, so we skip these computations
	const childrenArray = $derived(!flatMode ? Object.values(node?.children || []) : [])
	const hasChildren = $derived(node?.hasChildren || false)
	// In recursive mode, each nested Node compounds one level of margin-left.
	// In flat mode, all nodes are siblings so we multiply level × indent explicitly.
	// Both use the same CSS variable so theming works identically across modes.
	// flatGap replicates the recursive .ltree-children { margin-top: 2px } gap
	// — only applied before first-child nodes (where level > previous node's level).
	const indentStyle = $derived(
		flatMode
			? `margin-left: calc(${node?.level || 1} * var(--tree-node-indent-per-level, 0.5rem))${flatGap ? '; margin-top: 2px' : ''}`
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
			tree.bumpNodeRev(node) // re-render expand/collapse icon via {#key nodeRev}
			tree.refresh() // structural: recompute visibleFlatNodes
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

{#key nodeRev}
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
			class:ltree-draggable={node?.isDraggable && dragDropMode !== 'none'}
			class:ltree-glow-above={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'above' && isPositionAllowed('above')}
			class:ltree-glow-below={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'below' && isPositionAllowed('below')}
			class:ltree-glow-child={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && glowPosition === 'child' && isPositionAllowed('child')}
			class:ltree-drop-copy={isDragInProgress && isHoveredForDrop && dropOperation === 'copy'}
			draggable={node?.isDraggable && dragDropMode !== 'none'}
			onclick={(e) => {
				e.stopPropagation();
				_onNodeClicked();
			}}
			oncontextmenu={(e) => {
				e.stopPropagation();
				callbacks.onNodeRightClicked(node, e);
			}}
			ondragstart={(e) => {
				if (node?.isDraggable && dragDropMode !== 'none' && e.dataTransfer) {
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
{/key}
