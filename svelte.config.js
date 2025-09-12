import adapter from "@sveltejs/adapter-auto"
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
// import {sveltePreprocess} from "svelte-preprocess"

// const scssAliases = aliases => {
// 	return url => {
// 		for (const [alias, aliasPath] of Object.entries(aliases)) {
// 			if (url.indexOf(alias) === 0) {
// 				return {
// 					file: url.replace(alias, aliasPath),
// 				};
// 			}
// 		}
// 		return url;
// 	};
// };

/** @type {import("@sveltejs/kit").Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	// preprocess: sveltePreprocess({
	// 	scss: {
	// 		importer: [
	// 			scssAliases({
	// 				$lib: "./src/lib"
	// 			})
	// 		]
	// 	}
	// }),

	kit: {
		// Use static adapter for deployment
		adapter: adapter()
		// adapter: adapter({
		// 	pages: 'build',
		// 	assets: 'build',
		// 	fallback: 'index.html',
		// 	precompress: false,
		// 	strict: true
		// })
	}
}

export default config
