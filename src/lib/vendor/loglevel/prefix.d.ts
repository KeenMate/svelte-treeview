/**
 * Type declarations for vendored loglevel-plugin-prefix library
 */

import type { Logger, RootLogger } from './index.js';

interface PrefixOptions {
	template?: string;
	levelFormatter?: (level: string) => string;
	nameFormatter?: (name: string) => string;
	timestampFormatter?: (date: Date) => string;
	format?: (level: string, name: string | undefined, timestamp: string) => string;
}

interface LoglevelPluginPrefix {
	reg(rootLogger: RootLogger): void;
	apply(logger: Logger, config?: PrefixOptions): Logger;
}

declare const prefix: LoglevelPluginPrefix;
export default prefix;

export type { PrefixOptions, LoglevelPluginPrefix };
