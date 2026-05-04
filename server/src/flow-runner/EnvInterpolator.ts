/**
 * Interpolates `$VAR` and `${VAR}` placeholders in a string.
 *
 * Resolution order: overrides → header.env → process.env.
 * Unknown variables are left as-is and a warning is emitted to stderr.
 */
export function interpolate(value: string, env: Record<string, string>): string {
    // Handle ${VAR} first to avoid double-replacing $VAR inside ${...}
    let result = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
        if (Object.prototype.hasOwnProperty.call(env, name)) return env[name];
        process.stderr.write(`[EnvInterpolator] WARNING: variable "${name}" is not defined — leaving as-is\n`);
        return match;
    });

    result = result.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) => {
        if (Object.prototype.hasOwnProperty.call(env, name)) return env[name];
        process.stderr.write(`[EnvInterpolator] WARNING: variable "${name}" is not defined — leaving as-is\n`);
        return match;
    });

    return result;
}

/**
 * Builds the merged environment map used during a single flow run.
 *
 * Priority (highest wins): overrides → headerEnv → process.env
 */
export function buildEnv(
    headerEnv: Record<string, string> | undefined,
    overrides?: Record<string, string>,
): Record<string, string> {
    return {
        ...(process.env as Record<string, string>),
        ...(headerEnv ?? {}),
        ...(overrides ?? {}),
    };
}
