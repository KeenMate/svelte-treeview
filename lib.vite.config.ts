import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        dev: false
      }
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        styles: resolve(__dirname, 'src/styles.ts')
      },
      name: 'SvelteTreeview',
      fileName: (format, entryName) => {
        if (entryName === 'styles') return `styles.${format === 'es' ? 'js' : 'js'}`;
        return `index.${format === 'es' ? 'js' : 'umd.cjs'}`;
      }
    },
    rollupOptions: {
      external: ['svelte', 'svelte/internal', 'flexsearch'],
      output: {
        globals: {
          'svelte': 'svelte',
          'svelte/internal': 'svelteInternal',
          'flexsearch': 'FlexSearch'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'styles.css';
          }
          return '[name].[ext]';
        }
      }
    },
    sourcemap: true,
    emptyOutDir: true
  }
});