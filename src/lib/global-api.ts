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
} from './logger';

// Type declarations for build-time constants (injected by Vite)
declare const __VERSION__: string;
declare const __PACKAGE_NAME__: string;
declare const __AUTHOR__: string;
declare const __LICENSE__: string;
declare const __REPOSITORY__: string;
declare const __HOMEPAGE__: string;

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
        setCategoryLevel: (category: string, level: string) => void;
        getCategories: () => string[];
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
        version: () => __VERSION__,
        config: {
            name: __PACKAGE_NAME__,
            version: __VERSION__,
            author: __AUTHOR__,
            license: __LICENSE__,
            repository: __REPOSITORY__,
            homepage: __HOMEPAGE__
        },
        logging: {
            enableLogging,
            disableLogging,
            setLogLevel,
            setCategoryLevel,
            getCategories: () => [...LOGGING_CATEGORIES]
        }
    };
}
