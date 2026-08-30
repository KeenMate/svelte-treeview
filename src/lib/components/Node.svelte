<script lang="ts" generics="T">
	import {type LTreeNode} from "../ltree/ltree-node.svelte.js"
	import Node from "./Node.svelte"
	import {getContext, onDestroy, type Snippet} from "svelte"
	import type {Ltree, DropPosition, DropOperation} from "../ltree/types.js"
	import type {RenderCoordinator} from "./RenderCoordinator.svelte.js"
	import type {NodeCallbacks, NodeConfig} from "../core/TreeController.svelte.js"
	import { uiLogger } from "../logger.js"
	import { observeElementSize } from "../vendor/environment/element-size.js"
	import { computePosition, autoUpdate, offset, flip, shift } from "@floating-ui/dom"

	// Define component props interface
	// Callbacks and config come from context, drag state comes as props
	interface Props {
		node: LTreeNode<T>;
		children?: Snippet<[LTreeNode<T>]>; // Keep the general children slot for backward compatibility

		// Progressive rendering
		isProgressiveRender?: boolean;
		renderBatchSize?: number;

		// Drag state (passed as props for efficient Svelte diffing)
		isDraggedNode?: boolean;
		isDragInProgress?: boolean;
		hoveredNodeForDropPath?: string | null;
		activeDropPosition?: DropPosition | null;
		dropOperation?: DropOperation;

		// Flat rendering mode
		flatMode?: boolean; // When true, don't render children (Tree handles flat rendering)
		flatGap?: boolean; // When true in flat mode, add margin-top to match recursive .stv__children gap
	}

	// Destructure props using Svelte 5 syntax
	let {
		node,
		children = undefined,

		// Progressive rendering
		isProgressiveRender = false,
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

	// Read every config field through $derived so updates from controller.update()
	// or the controller's runtime $effect syncs propagate into this Node's render.
	// Plain destructuring would snapshot primitives once and never react.
	const expandIconClass = $derived(config.expandIconClass);
	const collapseIconClass = $derived(config.collapseIconClass);
	const leafIconClass = $derived(config.leafIconClass);
	const highlightedNodeClass = $derived(config.highlightedNodeClass);
	const focusedNodeClass = $derived(config.focusedNodeClass);
	// Data-driven per-row classes. The callbacks read node data; recompute when the
	// node's _rev bumps (same trigger the rest of the render uses).
	const customNodeClass = $derived(config.nodeClass ? (config.nodeClass(node) ?? '') : '');
	const customNodeContentClass = $derived(config.nodeContentClass ? (config.nodeContentClass(node) ?? '') : '');
	// dragOverNodeClass is applied to the DOM directly by the controller
	// (see hoveredNodeForDrop $effect in TreeController) — no per-Node binding.
	const clickBehavior = $derived(config.clickBehavior);
	const shouldShowCheckboxes = $derived(config.shouldShowCheckboxes);
	const checkboxMode = $derived(config.checkboxMode);
	const shouldClickToggleCheckbox = $derived(config.shouldClickToggleCheckbox);

	// Indeterminate state: driven by controller's _updateAncestorVisualStates
	const isIndeterminate = $derived(checkboxMode === 'cascade' && node.visualState === 'indeterminate');

	// Read dropZoneMode and isAccordionExpand through the proxy each time (not
	// destructured) so they stay reactive in flat mode where nodes are NOT
	// recreated on config change.
	const dropZoneMode = $derived(config.dropZoneMode);
	const isAccordionExpand = $derived(config.isAccordionExpand);
	const toggleIconMode = $derived(config.toggleIconMode);

	// Compute if THIS node is the one being hovered for drop.
	// Single source of truth from the controller — guarantees exactly one highlighted
	// row at a time, unlike the per-node local flag we used before (HTML5 dragleave
	// is unreliable and leaked stale highlights when moving fast between rows).
	const isHoveredForDrop = $derived(hoveredNodeForDropPath === node.path);

	const tree = getContext<Ltree<T>>("Ltree")
	const renderCoordinator = getContext<RenderCoordinator | null>("RenderCoordinator")

	// ── Node title overflow (wrap | ellipsis | info) ────────────────────────
	// wrap/ellipsis are pure CSS (gated by data-node-title-overflow on the container);
	// `info` additionally measures whether the built-in label is horizontally clipped and,
	// if so, shows a trailing ⓘ affordance that reveals the full label on click — the
	// touch/no-hover substitute for the native title tooltip. Only the default label path
	// (no nodeTemplate) participates; a snippet owns its own layout.
	const nodeTitleOverflow = $derived(config.nodeTitleOverflow)
	const displayValue = $derived(tree.getNodeDisplayValue(node))

	let labelEl: HTMLElement | undefined = $state()
	let isTruncated = $state(false)

	// Measure clip only in `info` mode. Re-runs when the text changes (displayValue dep)
	// and, via observeElementSize (shared ResizeObserver), whenever the label's box changes
	// (container resize, indent depth, font). scrollWidth > clientWidth ⇒ the ellipsis is cutting.
	$effect(() => {
		if (nodeTitleOverflow !== 'info' || !labelEl || children) {
			isTruncated = false
			return
		}
		const el = labelEl
		void displayValue // dependency: re-measure on content change
		const measure = () => { isTruncated = el.scrollWidth > el.clientWidth + 1 }
		measure()
		return observeElementSize(el, measure)
	})

	// Full-label reveal popover (info mode). One per node, opened on ⓘ click. A manual
	// floating panel (not a hover tooltip, which never fires on touch); dismissed by a
	// second click, an outside pointer, a scroll, or Escape.
	let infoBtnEl: HTMLElement | undefined = $state()
	let revealEl: HTMLElement | undefined = $state()
	let isRevealOpen = $state(false)

	function toggleReveal(e: MouseEvent) {
		e.stopPropagation()
		isRevealOpen = !isRevealOpen
	}

	$effect(() => {
		if (!isRevealOpen || !infoBtnEl || !revealEl) return
		const btn = infoBtnEl
		const panel = revealEl
		const stopAutoUpdate = autoUpdate(btn, panel, () => {
			computePosition(btn, panel, {
				strategy: 'fixed',
				placement: 'top-end',
				middleware: [offset(6), flip(), shift({ padding: 8 })]
			}).then(({ x, y }) => {
				panel.style.left = `${x}px`
				panel.style.top = `${y}px`
			})
		})
		const onOutside = (ev: Event) => {
			const t = ev.target as HTMLElement | null
			if (t !== btn && !panel.contains(t)) isRevealOpen = false
		}
		const onScroll = () => { isRevealOpen = false }
		const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') isRevealOpen = false }
		document.addEventListener('pointerdown', onOutside, true)
		window.addEventListener('scroll', onScroll, true)
		document.addEventListener('keydown', onKey, true)
		return () => {
			stopAutoUpdate()
			document.removeEventListener('pointerdown', onOutside, true)
			window.removeEventListener('scroll', onScroll, true)
			document.removeEventListener('keydown', onKey, true)
		}
	})

	// Glow/drop position is owned by the controller now (pointer-driven drag) and arrives
	// via the `activeDropPosition` prop — no per-node local calculation on dragover.

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


	// Resolve isCollapsible via tree's resolution method (callback > member > node property)
	const isCollapsible = $derived(tree.getNodeIsCollapsible(node));

	// Convert reactive statements to derived values
	// In flat mode, children rendering is handled by Tree.svelte, so we skip these computations
	const childrenArray = $derived(!flatMode ? Object.values(node?.children || []) : [])
	const hasChildren = $derived(node?.hasChildren || false)
	// Root nodes (level 1) sit flush against the left edge; only descendants indent,
	// so the offset is (level - 1) × indent (matches web-treeview's root-at-zero math).
	// In recursive mode, each nested Node compounds one level, so a root gets 0 and every
	// deeper node adds one indent. In flat mode all nodes are siblings, so we multiply
	// (level - 1) × indent explicitly. Both use the same CSS variable across modes.
	// flatGap replicates the recursive .stv__children { margin-top: 2px } gap
	// — only applied before first-child nodes (where level > previous node's level).
	const indentStyle = $derived(
		flatMode
			? `margin-left: calc(${Math.max(0, (node?.level || 1) - 1)} * var(--stv-node-indent-per-level, 0.5rem))${flatGap ? '; margin-top: 2px' : ''}`
			: `margin-left: ${(node?.level || 1) <= 1 ? '0px' : 'var(--stv-node-indent-per-level, 0.5rem)'}`,
	)

	// Progressive rendering state - only used in recursive mode
	let renderedCount = $state(0);
	let unregisterFromCoordinator: (() => void) | null = null;
	let lastExpandedState = false;
	let lastChildrenLength = 0;

	// Get the children to render (all or progressive slice) - only used in recursive mode
	const childrenToRender = $derived(
		!flatMode && isProgressiveRender && renderCoordinator
			? childrenArray.slice(0, renderedCount)
			: childrenArray
	);
	const hasMoreToRender = $derived(
		!flatMode && isProgressiveRender && renderCoordinator && renderedCount < childrenArray.length
	);

	// Handle expansion state changes - use coordinator for progressive rendering
	// Skip entirely in flat mode since Tree.svelte handles children rendering
	$effect(() => {
		if (flatMode) return; // Skip in flat mode - children handled by Tree

		const isExpanded = node?.isExpanded ?? false;
		const childCount = childrenArray.length;
		const shouldRenderProgressively = isProgressiveRender && renderCoordinator && childCount > 0;

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
		if (node.hasChildren && isCollapsible) {
			const newState = !node.isExpanded

			// Accordion: collapse siblings when expanding
			if (newState && isAccordionExpand) {
				const siblings = tree.getSiblings(node.path)
				uiLogger.debug(`[accordion] expanding ${node.path}, checking ${siblings.length} siblings, isAccordionExpand=${isAccordionExpand}`)
				for (const sibling of siblings) {
					if (sibling.path !== node.path && sibling.isExpanded && tree.getNodeIsCollapsible(sibling)) {
						uiLogger.debug(`[accordion] collapsing sibling: ${sibling.path}`)
						sibling.isExpanded = false
						sibling._rev = (sibling._rev || 0) + 1
					}
				}
			}

			uiLogger.debug(`${newState ? 'Expanding' : 'Collapsing'} node: ${node.path}`)
			node.isExpanded = newState
			// Bump _rev so flat-mode {#each} key changes and Svelte re-renders the icon
			node._rev = (node._rev || 0) + 1
			tree.refresh()
		}
	}

	// Svelte action to set the indeterminate DOM property (not settable via attribute)
	function setIndeterminate(el: HTMLInputElement, value: boolean) {
		el.indeterminate = value;
		return {
			update(newValue: boolean) {
				el.indeterminate = newValue;
			}
		};
	}

	function _onNodeClicked(event?: MouseEvent) {
		uiLogger.debug(`Node clicked: ${node.path}`, { id: node.id, hasChildren: node.hasChildren })
		const modifiers = event ? { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey } : undefined;
		const hasModifiers = !!(modifiers?.ctrl || modifiers?.shift);

		// Plain click on a selectable node with checkboxes shown → toggle the checkbox
		// instead of focusing/highlighting. Expand still happens if clickBehavior asks for it.
		// Modified clicks (Ctrl/Shift) fall through to the normal multi-highlight path.
		if (shouldClickToggleCheckbox && shouldShowCheckboxes && node.isSelectable && !hasModifiers) {
			callbacks.onCheckboxToggle(node, { skipFocus: true });
			if (clickBehavior !== 'select') toggleExpanded();
			return;
		}

		if (clickBehavior === 'expand') {
			// Expand only — no selection callback. Ctrl/Shift have no meaning here
			// (no selection to extend), so they shouldn't toggle expand either.
			if (!hasModifiers) toggleExpanded()
		} else if (clickBehavior === 'expand-and-focus') {
			// Select + expand on single click. Modified clicks are reserved for
			// highlight management — don't also toggle expand (matches OS file
			// explorers where Ctrl/Shift+click manages selection without opening).
			callbacks.onNodeClicked(node, modifiers)
			if (!hasModifiers) toggleExpanded()
		} else {
			// 'select' — single click selects only
			callbacks.onNodeClicked(node, modifiers)
		}
	}

	// Note: double-click in clickBehavior='select' is detected on the controller
	// side (see _lastSelectClickPath in TreeController). The browser's native
	// dblclick event isn't reliable here: the first click bumps node._rev for
	// the focus update, which destroys+recreates the row in flat-mode rendering,
	// so the browser sees the two clicks on different elements and skips the
	// dblclick. Manual detection on the (stable) controller avoids that.
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="stv__node {customNodeClass}"
	id="{node.treeId}-{node.id}"
	data-tree-path="{node.path}"
	style={indentStyle}
>
	<div class="stv__node-row">
		<!-- Toggle icon with its own click handler -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		{#if hasChildren && isCollapsible}
			<span
				class="stv__toggle-icon stv__clickable {toggleIconMode === 'swap'
					? (node.isExpanded ? collapseIconClass : expandIconClass)
					: expandIconClass}"
				class:expanded={toggleIconMode === 'rotate' && node.isExpanded}
				onclick={toggleExpanded}
			></span>
		{:else}
			<span class="stv__toggle-icon {leafIconClass}"></span>
		{/if}

		{#if shouldShowCheckboxes && node.isSelectable}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<label
				class="stv__checkbox"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					callbacks.onCheckboxToggle(node);
				}}
			>
				<input
					type="checkbox"
					checked={node.isSelected && !isIndeterminate}
					use:setIndeterminate={isIndeterminate}
					tabindex={-1}
				/>
				<span class="stv__checkbox-box"></span>
			</label>
		{/if}

		<!-- Node content with separate click handler -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="stv__node-content {node.isHighlighted ? highlightedNodeClass : ''} {node.isFocused && focusedNodeClass ? focusedNodeClass : ''} {customNodeContentClass}"
			class:stv__node-content--highlighted={node.isHighlighted && !highlightedNodeClass}
			class:stv__node-content--focused={node.isFocused}
			class:stv__clickable={node.isSelectable}
			class:stv__node-content--dragged={isDraggedNode}
			class:stv__node-content--draggable={node?.isDraggable}
			class:stv__node-content--glow-before={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && activeDropPosition === 'before' && isPositionAllowed('before')}
			class:stv__node-content--glow-after={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && activeDropPosition === 'after' && isPositionAllowed('after')}
			class:stv__node-content--glow-child={dropZoneMode === 'glow' && isDragInProgress && isHoveredForDrop && activeDropPosition === 'child' && isPositionAllowed('child')}
			class:stv__node-content--drop-copy={isDragInProgress && isHoveredForDrop && dropOperation === 'copy'}
			onclick={(e) => {
				e.stopPropagation();
				_onNodeClicked(e);
			}}
			oncontextmenu={(e) => {
				e.stopPropagation();
				callbacks.onNodeRightClicked(node, e);
			}}
			onpointerdown={(e) => callbacks.onPointerDown(node, e)}
		>
			{#if children}
				{@render children(node)}
			{:else}
				<span
					class="stv__node-label"
					bind:this={labelEl}
					title={nodeTitleOverflow === 'info' && isTruncated ? displayValue : null}
				>{displayValue}</span>
				{#if nodeTitleOverflow === 'info' && isTruncated}
					<button
						type="button"
						class="stv__node-info"
						aria-label="Show full label"
						bind:this={infoBtnEl}
						onpointerdown={(e) => e.stopPropagation()}
						onclick={toggleReveal}
					></button>
				{/if}
			{/if}
		</div>

	</div>

	<!-- Full-label reveal (info mode). position: fixed → escapes the tree's overflow clip;
	     placed by @floating-ui relative to the ⓘ button. -->
	{#if isRevealOpen}
		<div class="stv__node-info-reveal" role="tooltip" bind:this={revealEl}>{displayValue}</div>
	{/if}

	<!-- In flat mode, children are rendered by Tree.svelte, not recursively here -->
	{#if !flatMode && node?.isExpanded && node?.hasChildren}
		<div class="stv__children">
			{#each childrenToRender as item (item.id)}
				<Node
					node={item}
					{children}
					{isProgressiveRender}
					{renderBatchSize}
					{isDraggedNode}
					{isDragInProgress}
					{hoveredNodeForDropPath}
					{activeDropPosition}
					{dropOperation}
				/>
			{/each}
			{#if hasMoreToRender}
				<div class="stv__loading-more">
					Loading... ({renderedCount}/{childrenArray.length})
				</div>
			{/if}
		</div>
	{/if}
</div>
