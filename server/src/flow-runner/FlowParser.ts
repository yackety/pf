import { parse as parseYaml } from 'yaml';
import { buildEnv, interpolate } from './EnvInterpolator';
import type { FlowHeader, FlowStep, TapTarget } from './types';

// ---------------------------------------------------------------------------
// Internal normalizer map
// Each entry converts the raw YAML value for a step key into a typed FlowStep.
// ---------------------------------------------------------------------------

type RawNormalizer = (value: unknown) => FlowStep;

const NORMALIZERS: Record<string, RawNormalizer> = {
    // App lifecycle — no-value steps
    launchApp:    () => ({ kind: 'launchApp' }),
    restartApp:   () => ({ kind: 'restartApp' }),
    clearApp:     () => ({ kind: 'clearApp' }),
    stopApp:      () => ({ kind: 'stopApp' }),
    clearText:    () => ({ kind: 'clearText' }),
    hideKeyboard: () => ({ kind: 'hideKeyboard' }),
    back:         () => ({ kind: 'back' }),
    home:         () => ({ kind: 'home' }),

    // Interaction
    tapOn: (v) => ({
        kind: 'tapOn',
        target: typeof v === 'string' ? v : (v as TapTarget),
    }),
    longPressOn:  (v) => ({ kind: 'longPressOn',  target: v as string }),
    doubleTapOn:  (v) => ({ kind: 'doubleTapOn',  target: v as string }),
    inputText:    (v) => ({ kind: 'inputText',    text: v as string }),
    scroll:       (v) => ({ kind: 'scroll',       direction: v as 'up' | 'down' | 'left' | 'right' }),
    scrollTo:     (v) => ({ kind: 'scrollTo',     target: v as string }),
    swipe: (v) => {
        const { from, to } = v as { from: [number, number]; to: [number, number] };
        return { kind: 'swipe', from, to };
    },

    // Assertions
    assertVisible:     (v) => ({ kind: 'assertVisible',     target: v as string }),
    assertNotVisible:  (v) => ({ kind: 'assertNotVisible',  target: v as string }),
    assertChecked:     (v) => ({ kind: 'assertChecked',     target: v as string }),
    assertEqual: (v) => {
        const { id, value } = v as { id: string; value: string };
        return { kind: 'assertEqual', id, value };
    },

    // Waiting
    waitForVisible:    (v) => ({ kind: 'waitForVisible',    target: v as string }),
    waitForNotVisible: (v) => ({ kind: 'waitForNotVisible', target: v as string }),
    wait:              (v) => ({ kind: 'wait',              ms: v as number }),

    // Device / host
    screenshot: (v) => ({ kind: 'screenshot', name: v as string }),
    runScript:  (v) => ({ kind: 'runScript',  script: v as string }),
};

// No-value steps: the YAML item is just a bare string with no associated value.
const NO_VALUE_STEPS = new Set([
    'launchApp', 'restartApp', 'clearApp', 'stopApp',
    'clearText', 'hideKeyboard', 'back', 'home',
]);

// ---------------------------------------------------------------------------
// Parse options
// ---------------------------------------------------------------------------

export interface ParseOverrides {
    /** Injected at runtime (env var / API body). Never read from the YAML file. */
    udid?: string;
    /** Runtime env overrides merged on top of header.env. */
    env?: Record<string, string>;
}

export interface ParseResult {
    header: FlowHeader;
    steps: FlowStep[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class FlowParser {
    /**
     * Parses a flow YAML string into a typed `{ header, steps }` pair.
     *
     * The YAML file format is:
     * ```yaml
     * appId: com.example.app
     * platform: ios
     * ---
     * - launchApp
     * - tapOn: "Submit"
     * ```
     *
     * The first `\n---\n` is the document separator.
     * `overrides.udid` is injected directly into the header — callers must supply
     * it from the environment or API body; it must never come from the YAML itself.
     */
    static parse(yamlString: string, overrides: ParseOverrides = {}): ParseResult {
        const { headerRaw, stepsRaw } = FlowParser.splitDocuments(yamlString);

        const header = FlowParser.parseHeader(headerRaw, overrides);
        const env = buildEnv(header.env, overrides.env);
        const steps = FlowParser.parseSteps(stepsRaw, env);

        return { header, steps };
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private static splitDocuments(src: string): { headerRaw: string; stepsRaw: string } {
        const sep = '\n---\n';
        const idx = src.indexOf(sep);

        if (idx === -1) {
            throw new Error(
                'FlowParser: missing document separator "---". ' +
                'The flow file must have a header section followed by "---" and a steps section.',
            );
        }

        return {
            headerRaw: src.slice(0, idx).trim(),
            stepsRaw:  src.slice(idx + sep.length).trim(),
        };
    }

    private static parseHeader(raw: string, overrides: ParseOverrides): FlowHeader {
        const parsed = parseYaml(raw) as Record<string, unknown>;

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('FlowParser: header section is not a valid YAML object.');
        }

        if (typeof parsed['appId'] !== 'string' || !parsed['appId']) {
            throw new Error('FlowParser: header is missing required field "appId".');
        }

        const platform = parsed['platform'];
        if (platform !== 'android' && platform !== 'ios') {
            throw new Error(
                `FlowParser: header field "platform" must be "android" or "ios", got ${JSON.stringify(platform)}.`,
            );
        }

        const header: FlowHeader = {
            appId:        parsed['appId'] as string,
            platform:     platform,
            name:         parsed['name'] as string | undefined,
            // udid is intentionally NOT read from the YAML — only from overrides
            udid:         overrides.udid,
            tags:         parsed['tags'] as string[] | undefined,
            timeout:      parsed['timeout'] as number | undefined,
            resetApp:     parsed['resetApp'] as boolean | undefined,
            retries:      parsed['retries'] as number | undefined,
            stepRetries:  parsed['stepRetries'] as number | undefined,
            video:        parsed['video'] as boolean | undefined,
            env:          parsed['env'] as Record<string, string> | undefined,
        };

        // Warn if someone accidentally put udid in the YAML
        if (typeof parsed['udid'] === 'string') {
            process.stderr.write(
                `[FlowParser] WARNING: "udid" found in YAML header and will be ignored. ` +
                `Supply the device UDID at runtime via env var DEVICE_UDID, the API request body, ` +
                `or DevicePool allocation.\n`,
            );
        }

        return header;
    }

    private static parseSteps(raw: string, env: Record<string, string>): FlowStep[] {
        const items = parseYaml(raw) as unknown[];

        if (!Array.isArray(items)) {
            throw new Error('FlowParser: steps section must be a YAML sequence (list starting with "- ").');
        }

        return items.map((item, idx) => FlowParser.normalizeItem(item, idx, env));
    }

    private static normalizeItem(item: unknown, idx: number, env: Record<string, string>): FlowStep {
        const pos = `step[${idx + 1}]`;

        // --- bare string: "launchApp" ---
        if (typeof item === 'string') {
            const kind = item.trim();
            const normalizer = NORMALIZERS[kind];
            if (!normalizer) {
                throw new Error(`FlowParser: ${pos} unknown step type "${kind}".`);
            }
            if (!NO_VALUE_STEPS.has(kind)) {
                throw new Error(
                    `FlowParser: ${pos} step "${kind}" requires a value. ` +
                    `Use the object form, e.g. "- ${kind}: <value>".`,
                );
            }
            return normalizer(undefined);
        }

        // --- single-key object: { tapOn: "Submit" } ---
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            const keys = Object.keys(item as object);
            if (keys.length !== 1) {
                throw new Error(
                    `FlowParser: ${pos} step object must have exactly one key, got [${keys.join(', ')}].`,
                );
            }
            const kind = keys[0];
            const normalizer = NORMALIZERS[kind];
            if (!normalizer) {
                throw new Error(`FlowParser: ${pos} unknown step type "${kind}".`);
            }
            const rawValue = (item as Record<string, unknown>)[kind];
            const step = normalizer(rawValue);
            return FlowParser.interpolateStep(step, env);
        }

        throw new Error(`FlowParser: ${pos} unexpected item type: ${JSON.stringify(item)}.`);
    }

    /** Walk all string fields of a step and apply variable interpolation. */
    private static interpolateStep(step: FlowStep, env: Record<string, string>): FlowStep {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(step)) {
            if (typeof val === 'string') {
                result[key] = interpolate(val, env);
            } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                // e.g. tapOn: { testId: "$ID" }
                const nested: Record<string, unknown> = {};
                for (const [nk, nv] of Object.entries(val as Record<string, unknown>)) {
                    nested[nk] = typeof nv === 'string' ? interpolate(nv, env) : nv;
                }
                result[key] = nested;
            } else {
                result[key] = val;
            }
        }
        return result as unknown as FlowStep;
    }
}
