import svelte from "rollup-plugin-svelte";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import sveltePreprocess from "svelte-preprocess";
import postcss from "rollup-plugin-postcss";

const pkg = require("./package.json");

export default {
	input: pkg.main,
	output: [
		{ file: pkg.module, format: "es" },
		// { file: pkg.name, format: "umd", name: "svelte-adminlte" }
	],
	plugins: [
		svelte({
			preprocess: sveltePreprocess(),
		}),
		resolve(),
		commonjs(),
    postcss(),
	],
};
