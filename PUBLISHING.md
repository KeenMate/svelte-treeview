# Publishing Guide for @keenmate/svelte-treeview

## Library Structure

The library has been successfully prepared for publishing with the following structure:

### Core Library Files
- `src/lib/Tree.svelte` - Main tree component
- `src/lib/Node.svelte` - Individual node component  
- `src/lib/ltree/` - LTree Trie data structure implementation
- `src/lib/helpers/` - Utility functions
- `src/lib/treeData.ts` - Demo data generators
- `src/index.ts` - Main library entry point

### Demo Files (Separate)
- `demo/` - Complete demo application
- `demo/App.svelte` - Demo application with all examples
- `demo/assets/` - Demo-specific styles and assets

## Build Configuration

### Library Build
- **Config**: `lib.vite.config.ts`
- **Output**: `dist/` directory
- **Command**: `npm run build`

### Demo Build  
- **Config**: `demo.vite.config.ts`
- **Output**: `demo-dist/` directory
- **Command**: `npm run build:demo`

## Package Information

- **Name**: `@keenmate/svelte-treeview`
- **Version**: `4.0.0`
- **Main Entry**: `dist/index.js`
- **Types**: `dist/index.d.ts`
- **Styles**: `dist/styles.css`
- **Peer Dependencies**: `svelte ^5.0.0`
- **Dependencies**: `flexsearch ^0.8.205`

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

# Create package for testing
npm run package

# Check package contents
npm pack --dry-run

# Publish to npm (when ready)
npm publish --access public
```

## Usage Example

```bash
npm install @keenmate/svelte-treeview
```

```javascript
// Import styles in your main.js or main.ts
import '@keenmate/svelte-treeview/styles.css';
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

## Important: CSS Import Required

The component **requires** the CSS to be imported for proper styling. The styles include:

- Core component layout and positioning
- Tree node indentation and hierarchy visualization  
- Expand/collapse icons and animations
- Hover states and transitions
- Drag & drop visual feedback
- Context menu styling
- Selected node indicators

Without the CSS import, the tree will not display correctly.

## Next Steps

1. Test the package locally: `npm link` in this directory, then `npm link @keenmate/svelte-treeview` in a test project
2. Verify all exports work correctly
3. Test drag and drop functionality
4. Test search and filtering
5. Publish to npm registry when ready

## Files Created/Modified for Publishing

### New Files
- `lib.vite.config.ts` - Library build configuration
- `demo.vite.config.ts` - Demo build configuration  
- `tsconfig.lib.json` - TypeScript config for library
- `tsconfig.demo.json` - TypeScript config for demo
- `.npmignore` - Files to exclude from npm package
- `LICENSE` - MIT license file
- `PUBLISHING.md` - This guide

### Modified Files
- `package.json` - Updated for library publishing
- `README.md` - Comprehensive library documentation
- `src/index.ts` - Main library exports
- `tsconfig.json` - Updated references
- `demo/App.svelte` - Updated imports to reference library source

The library is now ready for publishing to npm as `@keenmate/svelte-treeview` version 4.0.0.