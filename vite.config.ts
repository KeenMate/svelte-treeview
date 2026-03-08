import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'__VERSION__': JSON.stringify(pkg.version),
		'__PACKAGE_NAME__': JSON.stringify(pkg.name),
		'__AUTHOR__': JSON.stringify(pkg.author),
		'__LICENSE__': JSON.stringify(pkg.license),
		'__REPOSITORY__': JSON.stringify(pkg.repository?.url || ''),
		'__HOMEPAGE__': JSON.stringify(pkg.homepage || '')
	}
});
