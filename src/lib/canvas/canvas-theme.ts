// ── Canvas Theme ─────────────────────────────────────────────────────────
// All visual values for canvas-rendered elements, readable from CSS custom
// properties (--ct-*) and overridable via props.

export interface CanvasTheme {
	// Canvas
	bg: string;

	// Node (idle)
	nodeBg: string;
	nodeBorder: string;
	nodeBorderWidth: number;
	nodeRadius: number;
	nodeText: string;

	// Node (selected)
	nodeSelectedBg: string;
	nodeSelectedBorder: string;

	// Node (hovered)
	nodeHoverBg: string;
	nodeHoverBorder: string;

	// Node (drop target)
	nodeDropBg: string;
	nodeDropBorder: string;

	// Node (search match)
	nodeMatchBg: string;
	nodeMatchBorder: string;
	nodeCurrentBg: string;
	nodeCurrentBorder: string;

	// Chevron
	chevronColor: string;
	chevronSize: number;

	// Badge
	badgeText: string;
	badgeHeight: number;
	badgeFontSize: number;

	// Connections
	connColor: string;
	connWidth: number;

	// Minimap
	minimapBg: string;
	minimapBorder: string;
	minimapViewport: string;
	minimapWidth: number;
	minimapHeight: number;

	// Dot Grid
	gridColor: string;
	gridSize: number;

	// Drop Zones
	dzBefore: string;
	dzAfter: string;
	dzChild: string;
	dzRadius: number;

	// Drag Ghost
	ghostBg: string;
	ghostBorder: string;
	ghostOpacity: number;

	// Tooltip (DOM)
	tooltipBg: string;
	tooltipText: string;
	tooltipRadius: string;

	// Context Menu (DOM)
	menuBg: string;
	menuText: string;
	menuHover: string;
	menuRadius: string;
}

/** Sensible defaults — match the previously hardcoded values */
export const defaultCanvasTheme: CanvasTheme = {
	bg: '#f8fafc',

	nodeBg: '#ffffff',
	nodeBorder: '#e2e8f0',
	nodeBorderWidth: 1.5,
	nodeRadius: 5,
	nodeText: '#334155',

	nodeSelectedBg: '#f0f4ff',
	nodeSelectedBorder: '#667eea',

	nodeHoverBg: '#fafbff',
	nodeHoverBorder: '#94a3b8',

	nodeDropBg: '#eff6ff',
	nodeDropBorder: '#3b82f6',

	nodeMatchBg: '#fefce8',
	nodeMatchBorder: '#f59e0b',
	nodeCurrentBg: '#fffbeb',
	nodeCurrentBorder: '#d97706',

	chevronColor: '#94a3b8',
	chevronSize: 10,

	badgeText: '#ffffff',
	badgeHeight: 14,
	badgeFontSize: 9,

	connColor: '#94a3b8',
	connWidth: 1.5,

	minimapBg: 'rgba(255,255,255,0.92)',
	minimapBorder: '#e2e8f0',
	minimapViewport: '#667eea',
	minimapWidth: 160,
	minimapHeight: 120,

	gridColor: '#cbd5e1',
	gridSize: 20,

	dzBefore: '#22c55e',
	dzAfter: '#f97316',
	dzChild: '#8b5cf6',
	dzRadius: 9,

	ghostBg: '#ffffff',
	ghostBorder: '#667eea',
	ghostOpacity: 0.7,

	tooltipBg: '#1e293b',
	tooltipText: '#f1f5f9',
	tooltipRadius: '6px',

	menuBg: '#1e293b',
	menuText: '#f1f5f9',
	menuHover: '#334155',
	menuRadius: '8px',
};

// ── CSS Variable Reading ─────────────────────────────────────────────────

/** CSS variable name → theme key mapping */
const CSS_VAR_MAP: [string, keyof CanvasTheme, 'string' | 'number'][] = [
	['--ct-bg',                  'bg',                  'string'],

	['--ct-node-bg',             'nodeBg',              'string'],
	['--ct-node-border',         'nodeBorder',          'string'],
	['--ct-node-border-width',   'nodeBorderWidth',     'number'],
	['--ct-node-radius',         'nodeRadius',          'number'],
	['--ct-node-text',           'nodeText',            'string'],

	['--ct-node-selected-bg',    'nodeSelectedBg',      'string'],
	['--ct-node-selected-border','nodeSelectedBorder',  'string'],

	['--ct-node-hover-bg',       'nodeHoverBg',         'string'],
	['--ct-node-hover-border',   'nodeHoverBorder',     'string'],

	['--ct-node-drop-bg',        'nodeDropBg',          'string'],
	['--ct-node-drop-border',    'nodeDropBorder',      'string'],

	['--ct-node-match-bg',       'nodeMatchBg',         'string'],
	['--ct-node-match-border',   'nodeMatchBorder',     'string'],
	['--ct-node-current-bg',     'nodeCurrentBg',       'string'],
	['--ct-node-current-border', 'nodeCurrentBorder',   'string'],

	['--ct-chevron-color',       'chevronColor',        'string'],
	['--ct-chevron-size',        'chevronSize',         'number'],

	['--ct-badge-text',          'badgeText',           'string'],
	['--ct-badge-height',        'badgeHeight',         'number'],
	['--ct-badge-font-size',     'badgeFontSize',       'number'],

	['--ct-conn-color',          'connColor',           'string'],
	['--ct-conn-width',          'connWidth',           'number'],

	['--ct-minimap-bg',          'minimapBg',           'string'],
	['--ct-minimap-border',      'minimapBorder',       'string'],
	['--ct-minimap-viewport',    'minimapViewport',     'string'],
	['--ct-minimap-width',       'minimapWidth',        'number'],
	['--ct-minimap-height',      'minimapHeight',       'number'],

	['--ct-grid-color',          'gridColor',           'string'],
	['--ct-grid-size',           'gridSize',            'number'],

	['--ct-dz-before',           'dzBefore',            'string'],
	['--ct-dz-after',            'dzAfter',             'string'],
	['--ct-dz-child',            'dzChild',             'string'],
	['--ct-dz-radius',           'dzRadius',            'number'],

	['--ct-ghost-bg',            'ghostBg',             'string'],
	['--ct-ghost-border',        'ghostBorder',         'string'],
	['--ct-ghost-opacity',       'ghostOpacity',        'number'],

	['--ct-tooltip-bg',          'tooltipBg',           'string'],
	['--ct-tooltip-text',        'tooltipText',         'string'],
	['--ct-tooltip-radius',      'tooltipRadius',       'string'],

	['--ct-menu-bg',             'menuBg',              'string'],
	['--ct-menu-text',           'menuText',            'string'],
	['--ct-menu-hover',          'menuHover',           'string'],
	['--ct-menu-radius',         'menuRadius',          'string'],
];

/**
 * Read CSS custom properties from an element and return partial theme overrides.
 * Only returns keys that are actually set on the element.
 */
export function readCssTheme(el: HTMLElement): Partial<CanvasTheme> {
	const style = getComputedStyle(el);
	const partial: Partial<CanvasTheme> = {};

	for (const [varName, key, type] of CSS_VAR_MAP) {
		const raw = style.getPropertyValue(varName).trim();
		if (!raw) continue;

		if (type === 'number') {
			const num = parseFloat(raw);
			if (!isNaN(num)) {
				(partial as Record<string, unknown>)[key] = num;
			}
		} else {
			(partial as Record<string, unknown>)[key] = raw;
		}
	}

	return partial;
}

/**
 * Merge theme layers: defaults → CSS variables → prop overrides.
 * Props have highest priority.
 */
export function resolveTheme(
	cssOverrides: Partial<CanvasTheme>,
	propOverrides: Partial<CanvasTheme>
): CanvasTheme {
	return { ...defaultCanvasTheme, ...cssOverrides, ...propOverrides };
}
