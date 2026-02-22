import { TreeController, type TreeControllerProps } from './TreeController.svelte.js';

/**
 * Factory function that creates a TreeController instance.
 *
 * IMPORTANT: Must be called during component initialization (inside a
 * component's `<script>` block) so that the controller's internal `$effect()`
 * calls bind to the component's lifecycle.
 */
export function createTreeController<T>(props: TreeControllerProps<T>): TreeController<T> {
	return new TreeController<T>(props);
}
