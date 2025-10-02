import { createLTree, type LTree } from './ltree.svelte';

// Usage Examples and Performance Test
export function demonstrateLTree() {
    const tree = createLTree('id', 'path', null, null, null, null, null, null, null, null, null, null, null, { isSorted: false, sortCallback: null });

    // Sample ltree paths
    const paths = [
        '1',
        '1.1',
        '1.1.1',
        '1.1.2',
        '1.1.2.1',
        '1.2',
        '1.2.1',
        '1.2.3.4',
        '2',
        '2.1',
        '2.1.1'
    ];

    console.log('=== LTree Demo ===');

    // Insert paths with some sample data
    console.log('\n1. Inserting paths...');
    paths.forEach((path, index) => {
        tree.insert(path, {id: index, name: `Node ${path}`});
        console.log(`Inserted: ${path}`);
    });

    // Search for specific paths
    console.log('\n2. Searching for paths...');
    console.log('Search "1.1.2":', tree.search('1.1.2'));
    console.log('Search "1.3" (non-existent):', tree.search('1.3'));

    // Find by prefix
    console.log('\n3. Finding paths by prefix...');
    console.log('Prefix "1.1":', tree.findByPrefix('1.1'));
    console.log('Prefix "1.2":', tree.findByPrefix('1.2'));

    // Get direct children
    console.log('\n4. Getting direct children...');
    console.log('Children of "1":', tree.getDirectChildren('1'));
    console.log('Children of "1.1":', tree.getDirectChildren('1.1'));

    // Get ancestors
    console.log('\n5. Getting ancestors...');
    console.log('Ancestors of "1.1.2.1":', tree.getAncestors('1.1.2.1'));

    // Statistics
    console.log('\n6. Tree statistics:');
    console.log(tree.getStats());

    return tree;
}

// Performance test with larger dataset
export function performanceTest(): void {
    console.log('\n=== Performance Test ===');
    const tree = createLtree('path', 'path', null, null, null, null, null, null, null, null, null, null, null, { isSorted: false, sortCallback: null });
    const paths: string[] = [];

    // Generate test data: hierarchical paths up to 4 levels deep
    console.log('Generating test data...');
    for (let a = 1; a <= 100; a++) {
        paths.push(`${a}`);
        for (let b = 1; b <= 50; b++) {
            paths.push(`${a}.${b}`);
            for (let c = 1; c <= 20; c++) {
                paths.push(`${a}.${b}.${c}`);
                for (let d = 1; d <= 5; d++) {
                    paths.push(`${a}.${b}.${c}.${d}`);
                }
            }
        }
    }

    console.log(`Generated ${paths.length} paths`);

    // Test insertion
    console.time('Insertion');
    paths.forEach(path => tree.insert(path, {path}));
    console.timeEnd('Insertion');

    // Test search performance
    console.time('Search 1000 random paths');
    for (let i = 0; i < 1000; i++) {
        const randomPath = paths[Math.floor(Math.random() * paths.length)];
        tree.search(randomPath);
    }
    console.timeEnd('Search 1000 random paths');

    // Test prefix search
    console.time('Prefix search for "1."');
    const results = tree.findByPrefix('1.');
    console.timeEnd('Prefix search for "1."');
    console.log(`Found ${results?.length} paths with prefix "1."`);

    // Memory usage
    const stats = tree.getStats();
    console.log('Final statistics:', stats);
}

// Run demonstrations if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
    demonstrateLtree();
    performanceTest();
}
