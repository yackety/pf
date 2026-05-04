import type { AppiumDriver, FlowHeader, FlowStep } from './types';

// ---------------------------------------------------------------------------
// StepContext — passed to every handler
// ---------------------------------------------------------------------------

export interface StepContext {
    driver: AppiumDriver;
    step: FlowStep;
    header: FlowHeader;
    /** Absolute path for screenshots / artifacts (from RunContext). */
    artifactRoot: string;
    /** Per-step element-wait timeout in ms (from header.timeout, default 10 000). */
    timeout: number;
    /**
     * Handlers may write captured output here (e.g. runScript stdout+stderr).
     * StepExecutor reads this and stores it in StepResult.output.
     */
    output?: string;
}

// ---------------------------------------------------------------------------
// StepHandler
// ---------------------------------------------------------------------------

export type StepHandler = (ctx: StepContext) => Promise<void>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry = new Map<string, StepHandler>();

export const StepHandlerRegistry = {
    /**
     * Register a handler for a step kind.
     * Silently overwrites if already registered (allows test doubles).
     */
    register(kind: string, fn: StepHandler): void {
        registry.set(kind, fn);
    },

    /**
     * Resolve a handler by step kind.
     * Throws if the kind has no registered handler.
     */
    resolve(kind: string): StepHandler {
        const fn = registry.get(kind);
        if (!fn) {
            throw new Error(`StepHandlerRegistry: unknown step type "${kind}". Has the handler module been imported?`);
        }
        return fn;
    },

    /** Returns true if a handler is registered for the given kind. */
    has(kind: string): boolean {
        return registry.has(kind);
    },

    /** Number of registered handlers. */
    get size(): number {
        return registry.size;
    },
};
