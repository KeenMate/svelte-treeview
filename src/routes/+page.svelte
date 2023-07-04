<script lang="ts">
	import { marked } from 'marked';

	import code from '../../README.md';
</script>

{@html marked(code)}
