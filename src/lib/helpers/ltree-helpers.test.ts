import { describe, it, expect } from 'vitest';
import { getParentPath, getRelativePath, getPathSegments, getLevel } from './ltree-helpers';

describe('ltree-helpers', () => {
	describe('getParentPath', () => {
		it('should return parent path with default separator', () => {
			expect(getParentPath('1.2.3')).toBe('1.2');
			expect(getParentPath('1.2')).toBe('1');
			expect(getParentPath('1')).toBe('');
		});

		it('should return parent path with custom single-character separator', () => {
			expect(getParentPath('1/2/3', '/')).toBe('1/2');
			expect(getParentPath('1/2', '/')).toBe('1');
			expect(getParentPath('1', '/')).toBe('');
		});

		it('should return parent path with multi-character separator (e.g. "1::2::3" → "1::2")', () => {
			expect(getParentPath('1::2::3', '::')).toBe('1::2');
			expect(getParentPath('1::2', '::')).toBe('1');
			expect(getParentPath('1', '::')).toBe('');
		});

		it('should handle edge cases', () => {
			expect(getParentPath('', '.')).toBe(null); // Empty string returns null
			expect(getParentPath(null as any)).toBe(null);
			expect(getParentPath(undefined as any)).toBe(null);
			expect(getParentPath('no-separator')).toBe('');
		});

		it('should handle complex multi-character separators', () => {
			expect(getParentPath('a->>b->>c', '->>')).toBe('a->>b');
			expect(getParentPath('root<|>child<|>grandchild', '<|>')).toBe('root<|>child');
		});
	});

	describe('getRelativePath', () => {
		it('should return relative path with default separator', () => {
			expect(getRelativePath('1.2.3', '1.2')).toBe('3');
			expect(getRelativePath('1.2.3.4', '1.2')).toBe('3.4');
			expect(getRelativePath('1.2', '1')).toBe('2');
		});

		it('should return relative path with custom single-character separator', () => {
			expect(getRelativePath('1/2/3', '1/2', '/')).toBe('3');
			expect(getRelativePath('1/2/3/4', '1/2', '/')).toBe('3/4');
			expect(getRelativePath('1/2', '1', '/')).toBe('2');
		});

		it('should return relative path with multi-character separator (e.g. "1::2::3" from "1::2" → "3")', () => {
			expect(getRelativePath('1::2::3', '1::2', '::')).toBe('3');
			expect(getRelativePath('1::2::3::4', '1::2', '::')).toBe('3::4');
			expect(getRelativePath('1::2', '1', '::')).toBe('2');
		});

		it('should handle edge cases', () => {
			expect(getRelativePath('1.2.3', '')).toBe('1.2.3');
			expect(getRelativePath('1.2.3', null as any)).toBe('1.2.3');
			expect(getRelativePath('1.2.3', undefined as any)).toBe('1.2.3');
			expect(getRelativePath('1.2.3', '1.2.4')).toBe('1.2.3'); // Non-matching parent
		});

		it('should handle complex multi-character separators', () => {
			expect(getRelativePath('a->>b->>c', 'a->>b', '->>')).toBe('c');
			expect(getRelativePath('root<|>child<|>grandchild', 'root<|>child', '<|>')).toBe('grandchild');
		});
	});

	describe('getPathSegments', () => {
		it('should return path segments with default separator', () => {
			expect(getPathSegments('1.2.3')).toBe('1');
			expect(getPathSegments('1.2.3', 1)).toBe('2');
			expect(getPathSegments('1.2.3', 2)).toBe('3');
			expect(getPathSegments('1.2.3', 0, 2)).toBe('1.2');
			expect(getPathSegments('1.2.3', 1, 2)).toBe('2.3');
		});

		it('should return path segments with custom single-character separator', () => {
			expect(getPathSegments('1/2/3', 0, 1, '/')).toBe('1');
			expect(getPathSegments('1/2/3', 1, 1, '/')).toBe('2');
			expect(getPathSegments('1/2/3', 0, 2, '/')).toBe('1/2');
		});

		it('should return path segments with multi-character separator (e.g. "1::2::3" first segment → "1")', () => {
			expect(getPathSegments('1::2::3', 0, 1, '::')).toBe('1');
			expect(getPathSegments('1::2::3', 1, 1, '::')).toBe('2');
			expect(getPathSegments('1::2::3', 0, 2, '::')).toBe('1::2');
			expect(getPathSegments('1::2::3', 1, 2, '::')).toBe('2::3');
		});

		it('should handle edge cases', () => {
			expect(getPathSegments('', 0, 1, '.')).toBe('');
			expect(getPathSegments('single', 0, 1, '.')).toBe('single');
			expect(getPathSegments('1.2.3', 10, 1, '.')).toBe(''); // Out of bounds
		});

		it('should handle complex multi-character separators', () => {
			expect(getPathSegments('a->>b->>c', 0, 1, '->>')).toBe('a');
			expect(getPathSegments('a->>b->>c', 1, 2, '->>')).toBe('b->>c');
		});
	});

	describe('getLevel', () => {
		it('should return correct level with default separator', () => {
			expect(getLevel('1', '.')).toBe(1);
			expect(getLevel('1.2', '.')).toBe(2);
			expect(getLevel('1.2.3', '.')).toBe(3);
			expect(getLevel('1.2.3.4.5', '.')).toBe(5);
		});

		it('should return correct level with custom single-character separator', () => {
			expect(getLevel('1', '/')).toBe(1);
			expect(getLevel('1/2', '/')).toBe(2);
			expect(getLevel('1/2/3', '/')).toBe(3);
			expect(getLevel('1/2/3/4/5', '/')).toBe(5);
		});

		it('should return correct level with multi-character separator (e.g. "1::2::3" → level 3)', () => {
			expect(getLevel('1', '::')).toBe(1);
			expect(getLevel('1::2', '::')).toBe(2);
			expect(getLevel('1::2::3', '::')).toBe(3);
			expect(getLevel('1::2::3::4::5', '::')).toBe(5);
		});

		it('should handle edge cases', () => {
			expect(getLevel('', '.')).toBe(1); // Empty string splits to ['']
			expect(getLevel('no-separator', '.')).toBe(1);
		});

		it('should handle complex multi-character separators', () => {
			expect(getLevel('a', '->>')).toBe(1);
			expect(getLevel('a->>b', '->>')).toBe(2);
			expect(getLevel('a->>b->>c', '->>')).toBe(3);
			expect(getLevel('root<|>child<|>grandchild', '<|>')).toBe(3);
		});
	});

	describe('Multi-character separator edge cases', () => {
		it('should handle separators that contain other separators', () => {
			// Test case where separator contains a dot
			expect(getParentPath('a.:b.:c', '.:')).toBe('a.:b');
			expect(getRelativePath('a.:b.:c', 'a.:b', '.:')).toBe('c');
			expect(getPathSegments('a.:b.:c', 0, 1, '.:')).toBe('a');
			expect(getLevel('a.:b.:c', '.:')).toBe(3);
		});

		it('should handle separators that appear within path segments', () => {
			// Test case where path contains separator substring
			expect(getParentPath('a::b::c::d', '::')).toBe('a::b::c');
			expect(getRelativePath('a::b::c::d', 'a::b', '::')).toBe('c::d');
		});

		it('should handle repeated separators', () => {
			// Edge case: what if path has consecutive separators?
			expect(getLevel('a....b', '..')).toBe(3); // 'a', '', 'b'
			expect(getPathSegments('a....b', 1, 1, '..')).toBe('');
		});

		it('should handle very long separators', () => {
			const longSep = '<->.<->';
			expect(getParentPath(`a${longSep}b${longSep}c`, longSep)).toBe(`a${longSep}b`);
			expect(getLevel(`a${longSep}b${longSep}c`, longSep)).toBe(3);
		});
	});
});