// Shared render mode state for all example pages.
// Persisted to localStorage so mode survives navigation.

const STORAGE_KEY = 'svelte-treeview-example-render-mode';

export type RenderMode = 'recursive' | 'progressive' | 'virtual';

function loadMode(): RenderMode {
	try {
		const saved = localStorage?.getItem(STORAGE_KEY);
		if (saved === 'recursive' || saved === 'progressive' || saved === 'virtual') return saved;
	} catch {}
	return 'recursive';
}

// Private state - can't export reassigned $state or $derived from module
let _renderMode = $state<RenderMode>(loadMode());

const _treeProps = $derived({
	isFlatRenderingEnabled: _renderMode === 'progressive' || _renderMode === 'virtual',
	isProgressiveRender: _renderMode === 'progressive',
	isVirtualScrollEnabled: _renderMode === 'virtual',
});

// Getters - reactive when called inside reactive contexts (templates, $derived, $effect)
export function getRenderMode(): RenderMode {
	return _renderMode;
}

export function getTreeProps() {
	return _treeProps;
}

export function setRenderMode(mode: RenderMode) {
	_renderMode = mode;
	try { localStorage?.setItem(STORAGE_KEY, mode); } catch {}
}
