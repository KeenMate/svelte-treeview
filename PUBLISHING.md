# Publishing Guide for @keenmate/svelte-treeview

## Library Structure

The library follows the standard SvelteKit library format with the following structure:

### Core Library Files
- `src/lib/components/Tree.svelte` - Main tree component
- `src/lib/components/Node.svelte` - Individual node component  
- `src/lib/ltree/` - LTree data structure implementation
- `src/lib/helpers/` - Utility functions
- `src/lib/demo/` - Demo data generators and sample data
- `src/lib/styles/` - SCSS styling files
- `src/lib/index.ts` - Main library entry point

### Development Files
- `src/routes/` - SvelteKit development/demo pages
- `src/app.html` - SvelteKit app template

## Build Configuration

### Library Build
- **Config**: `vite.config.ts` (with SvelteKit plugin)
- **SvelteKit Config**: `svelte.config.js`
- **Output**: `dist/` directory
- **Command**: `npm run build` (runs `vite build && npm run prepack`)
- **Packaging**: Uses `svelte-package` for library preparation

## Package Information

- **Name**: `@keenmate/svelte-treeview`
- **Version**: `4.0.0-rc01`
- **Main Entry**: `dist/index.js`
- **Types**: `dist/index.d.ts`
- **Styles**: `dist/styles.scss`
- **Peer Dependencies**: `svelte ^5.0.0`
- **Optional Dependencies**: `flexsearch ^0.8.205`

## Key Features Included

1. **Svelte 5 Native** - Built with Svelte 5 runes
2. **Drag & Drop** - Full drag and drop support with validation
3. **Search & Filter** - FlexSearch integration
4. **Context Menus** - Right-click context menus
5. **Custom Styling** - Extensive CSS customization
6. **TypeScript** - Full TypeScript support

## Publishing Commands

```bash
# Build the library
npm run build

# Check package contents
npm pack --dry-run

# Test package locally
npm link

# Publish to npm (when ready)
npm publish --access public
```

## Usage Example

```bash
npm install @keenmate/svelte-treeview
```

```javascript
// Import styles in your main.js or main.ts
import '@keenmate/svelte-treeview/styles.scss';
```

```svelte
<script>
  import { Tree } from '@keenmate/svelte-treeview';
  
  const data = [
    { path: '1', name: 'Root 1' },
    { path: '1.1', name: 'Child 1.1' },
    { path: '2', name: 'Root 2' }
  ];
</script>

<Tree 
  {data} 
  idMember="path" 
  pathMember="path" 
  displayValueMember="name" 
/>
```

## Important: SCSS Import Required

The component **requires** the SCSS to be imported for proper styling. The styles include:

- Core component layout and positioning
- Tree node indentation and hierarchy visualization  
- Expand/collapse icons and animations
- Hover states and transitions
- Drag & drop visual feedback
- Context menu styling
- Selected node indicators

Without the SCSS import, the tree will not display correctly.

## Next Steps

1. Test the package locally: `npm link` in this directory, then `npm link @keenmate/svelte-treeview` in a test project
2. Verify all exports work correctly
3. Test drag and drop functionality
4. Test search and filtering
5. Publish to npm registry when ready

## SvelteKit Library Structure

### Configuration Files
- `vite.config.ts` - Vite configuration with SvelteKit plugin
- `svelte.config.js` - SvelteKit configuration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Package configuration with library exports

### Library Files
- `src/lib/index.ts` - Main library exports
- `src/lib/components/` - Svelte components
- `src/lib/ltree/` - Core LTree data structure
- `src/lib/helpers/` - Utility functions
- `src/lib/styles/` - SCSS styling

### Build Process
The library uses the standard SvelteKit library workflow:
1. `vite build` - Builds the SvelteKit app
2. `svelte-package` - Packages the library from `src/lib/`
3. `publint` - Validates the package

The library is now ready for publishing to npm as `@keenmate/svelte-treeview` version 4.0.0-rc01.