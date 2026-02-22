<script lang="ts" generics="T">
	import { setContext, onDestroy, type Snippet } from 'svelte';
	import { createTreeController } from '../core/createTreeController.js';
	import { TreeController, type TreeControllerProps } from '../core/TreeController.svelte.js';

	interface Props extends TreeControllerProps<T> {
		children?: Snippet<[TreeController<T>]>;
	}

	let {
		children,
		...controllerProps
	}: Props = $props();

	const controller = createTreeController<T>(controllerProps as TreeControllerProps<T>);

	// Set contexts that Node.svelte expects
	setContext('Ltree', controller.tree);
	setContext('NodeCallbacks', controller.nodeCallbacks);
	setContext('NodeConfig', controller.nodeConfig);
	if (controller.renderCoordinator) {
		setContext('RenderCoordinator', controller.renderCoordinator);
	}

	onDestroy(() => controller.destroy());
</script>

{@render children?.(controller)}
