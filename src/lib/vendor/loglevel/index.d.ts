/**
 * Type declarations for vendored loglevel library
 */

type LogLevelNames = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

type LogLevelNumbers = 0 | 1 | 2 | 3 | 4 | 5;

type LogLevels = {
	TRACE: 0;
	DEBUG: 1;
	INFO: 2;
	WARN: 3;
	ERROR: 4;
	SILENT: 5;
};

type MethodFactory = (
	methodName: string,
	logLevel: LogLevelNumbers,
	loggerName: string
) => (...args: any[]) => void;

interface Logger {
	name: string | symbol;
	levels: LogLevels;
	methodFactory: MethodFactory;

	trace(...msg: any[]): void;
	debug(...msg: any[]): void;
	info(...msg: any[]): void;
	warn(...msg: any[]): void;
	error(...msg: any[]): void;
	log(...msg: any[]): void;

	getLevel(): LogLevelNumbers;
	setLevel(level: LogLevelNames | LogLevelNumbers, persist?: boolean): void;
	setDefaultLevel(level: LogLevelNames | LogLevelNumbers): void;
	resetLevel(): void;
	enableAll(persist?: boolean): void;
	disableAll(persist?: boolean): void;
	rebuild(): void;
}

interface RootLogger extends Logger {
	getLogger(name: string | symbol): Logger;
	getLoggers(): Record<string, Logger>;
	noConflict(): RootLogger;
	default: RootLogger;
}

declare const log: RootLogger;
export default log;

export type { Logger, RootLogger, LogLevelNames, LogLevelNumbers, LogLevels, MethodFactory };
