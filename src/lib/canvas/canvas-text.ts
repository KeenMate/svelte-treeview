/**
 * Text measurement cache for canvas rendering.
 * Avoids repeated measureText calls which are expensive.
 */
export function createTextCache() {
	const cache = new Map<string, number>();
	let measureCtx: CanvasRenderingContext2D | null = null;
	let currentFont = '';

	function ensureCtx() {
		if (!measureCtx) {
			const c = document.createElement('canvas');
			measureCtx = c.getContext('2d')!;
			if (currentFont) measureCtx.font = currentFont;
		}
		return measureCtx;
	}

	return {
		setFont(font: string) {
			if (font !== currentFont) {
				currentFont = font;
				cache.clear();
				if (measureCtx) measureCtx.font = font;
			}
		},

		getTextWidth(text: string): number {
			let w = cache.get(text);
			if (w !== undefined) return w;
			const ctx = ensureCtx();
			ctx.font = currentFont;
			w = ctx.measureText(text).width;
			cache.set(text, w);
			return w;
		},

		clear() {
			cache.clear();
		},

		truncateWithEllipsis(text: string, maxWidth: number): string {
			const ctx = ensureCtx();
			ctx.font = currentFont;
			const textW = cache.get(text) ?? ctx.measureText(text).width;
			if (textW <= maxWidth) return text;

			const ellipsis = '\u2026';
			const ellipsisW = cache.get(ellipsis) ?? ctx.measureText(ellipsis).width;
			const avail = maxWidth - ellipsisW;
			if (avail <= 0) return ellipsis;

			let lo = 0;
			let hi = text.length;
			while (lo < hi) {
				const mid = (lo + hi + 1) >> 1;
				const sliceW = cache.get(text.slice(0, mid)) ?? ctx.measureText(text.slice(0, mid)).width;
				if (sliceW <= avail) lo = mid;
				else hi = mid - 1;
			}
			return text.slice(0, lo) + ellipsis;
		}
	};
}

export type TextCache = ReturnType<typeof createTextCache>;
