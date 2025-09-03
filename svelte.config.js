import adapter from "@sveltejs/adapter-auto"
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import {sveltePreprocess} from "svelte-preprocess"

const scssAliases = aliases => {
	return url => {
		for (const [alias, aliasPath] of Object.entries(aliases)) {
			if (url.indexOf(alias) === 0) {
				return {
					file: url.replace(alias, aliasPath),
				};
			}
		}
		return url;
	};
};

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
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
}

export default config
