<script lang="ts">
	// Floating "on this page" chapter nav on every example page. It auto-scans the
	// page's <h2> section headings (and re-scans after client-side navigation).
	import ChapterNav from '../ChapterNav.svelte';
</script>

<slot />

<ChapterNav />
