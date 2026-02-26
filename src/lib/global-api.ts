/**
 * Global API registration for runtime logging control
 * This file is imported by Tree.svelte to ensure it runs when the component is used
 */

import {
    setLogLevel,
    enableLogging,
    disableLogging,
    setCategoryLevel,
    LOGGING_CATEGORIES
} from './logger.js';

import {
    enablePerfLogging,
    disablePerfLogging,
    setPerfThreshold,
    isPerfLoggingEnabled
} from './perf-logger.js';

// Import generated constants (created by scripts/generate-constants.js)
import {
    VERSION,
    PACKAGE_NAME,
    AUTHOR,
    LICENSE,
    REPOSITORY,
    HOMEPAGE
} from './constants.generated.js';

// Global API interface
export interface GlobalTreeviewAPI {
    version: () => string;
    config: {
        name: string;
        version: string;
        author: string;
        license: string;
        repository: string;
        homepage: string;
    };
    logging: {
        enableLogging: () => void;
        disableLogging: () => void;
        setLogLevel: (level: string) => void;
        setCategoryLevel: (category: string, level?: string) => void;
        getCategories: () => string[];
    };
    perf: {
        enable: () => void;
        disable: () => void;
        setThreshold: (ms: number) => void;
        isEnabled: () => boolean;
    };
}

// Declare global namespace
declare global {
    interface Window {
        components?: {
            'svelte-treeview'?: GlobalTreeviewAPI;
        };
    }
}

// Initialize global API for runtime logging control
if (typeof window !== 'undefined') {
    window.components = window.components || {};
    window.components['svelte-treeview'] = {
        version: () => VERSION,
        config: {
            name: PACKAGE_NAME,
            version: VERSION,
            author: AUTHOR,
            license: LICENSE,
            repository: REPOSITORY,
            homepage: HOMEPAGE
        },
        logging: {
            enableLogging,
            disableLogging,
            setLogLevel: setLogLevel as (level: string) => void,
            setCategoryLevel: setCategoryLevel as (category: string, level?: string) => void,
            getCategories: () => [...LOGGING_CATEGORIES]
        },
        perf: {
            enable: enablePerfLogging,
            disable: disablePerfLogging,
            setThreshold: setPerfThreshold,
            isEnabled: isPerfLoggingEnabled
        }
    };
}
