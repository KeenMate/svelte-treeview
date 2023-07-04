import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { string } from "rollup-plugin-string";
export default defineConfig({
	plugins: [sveltekit(), string({
		include: "**/*.md"
	})]
});
