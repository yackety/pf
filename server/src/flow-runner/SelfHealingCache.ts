import fs from 'fs';
import path from 'path';
import type { StrategyName } from './SelectorResolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedSelector {
    selector: string;
    strategy: StrategyName;
}

interface CacheKey {
    appId: string;
    appVersion: string;
    label: string;
}

/** On-disk shape: nested object appId → appVersion → label → CachedSelector */
type CacheStore = Record<string, Record<string, Record<string, CachedSelector>>>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_PATH = path.resolve('.cache', 'selectors.json');

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let store: CacheStore = {};
let loaded = false;

function ensureLoaded(): void {
    if (loaded) return;
    store = loadFromDisk();
    loaded = true;
}

function loadFromDisk(): CacheStore {
    try {
        const text = fs.readFileSync(CACHE_PATH, 'utf-8');
        return JSON.parse(text) as CacheStore;
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            // First run — start with an empty cache, don't create the file yet.
            return {};
        }
        // Corrupted file — reset to empty and overwrite on next save.
        console.warn('[SelfHealingCache] Could not parse cache file; resetting.', e);
        return {};
    }
}

function saveToDisk(): void {
    const dir = path.dirname(CACHE_PATH);
    fs.mkdirSync(dir, { recursive: true });

    const tmp = `${CACHE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmp, CACHE_PATH);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const SelfHealingCache = {
    /** Return a cached selector, or undefined on miss. */
    get(appId: string, appVersion: string, label: string): CachedSelector | undefined {
        ensureLoaded();
        return store[appId]?.[appVersion]?.[label];
    },

    /** Write a winning selector into the cache and persist to disk. */
    set(appId: string, appVersion: string, label: string, entry: CachedSelector): void {
        ensureLoaded();
        if (!store[appId]) store[appId] = {};
        if (!store[appId][appVersion]) store[appId][appVersion] = {};
        store[appId][appVersion][label] = entry;
        saveToDisk();
    },

    /** Remove a stale cache entry (called when a cached selector stops working). */
    invalidate(appId: string, appVersion: string, label: string): void {
        ensureLoaded();
        if (store[appId]?.[appVersion]?.[label]) {
            delete store[appId][appVersion][label];
            saveToDisk();
        }
    },

    /**
     * Reload the in-memory store from disk.
     * Useful in tests or long-running processes where another worker may have updated the file.
     */
    reload(): void {
        store = loadFromDisk();
        loaded = true;
    },

    /** Reset in-memory state (test helper). */
    _reset(): void {
        store = {};
        loaded = false;
    },
};
