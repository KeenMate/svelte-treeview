<script lang="ts">
	import {joinPaths} from "@keenmate/js-common-helpers/helpers/string.js"

	const githubUrlBase = "https://github.com/KeenMate/svelte-treeview/blob/master/"

	interface Props {
		relativePath: string;
	}

	let { relativePath }: Props = $props();

	let fullUrl = $derived(joinPaths(githubUrlBase, relativePath))
</script>

<a href={fullUrl}>
	<!-- <i class="fa-brands fa-github" /> -->
	View source on github
</a>
