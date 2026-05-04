import { buildEnv, interpolate } from '../EnvInterpolator';
import { FlowParser } from '../FlowParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flow(header: string, steps: string): string {
    return `${header}\n---\n${steps}`;
}

const MINIMAL_HEADER = 'appId: com.example.app\nplatform: ios';

// ---------------------------------------------------------------------------
// FlowParser — header parsing
// ---------------------------------------------------------------------------

describe('FlowParser.parse — header', () => {
    test('parses required fields', () => {
        const { header } = FlowParser.parse(flow(MINIMAL_HEADER, '- launchApp'));
        expect(header.appId).toBe('com.example.app');
        expect(header.platform).toBe('ios');
    });

    test('parses all optional header fields', () => {
        const yaml = flow(
            [
                'appId: com.example.app',
                'platform: android',
                'name: My Flow',
                'tags: [smoke, android14]',
                'timeout: 8000',
                'resetApp: true',
                'retries: 2',
                'stepRetries: 3',
                'video: true',
                'env:',
                '  USER: alice',
            ].join('\n'),
            '- launchApp',
        );
        const { header } = FlowParser.parse(yaml);
        expect(header.name).toBe('My Flow');
        expect(header.platform).toBe('android');
        expect(header.tags).toEqual(['smoke', 'android14']);
        expect(header.timeout).toBe(8000);
        expect(header.resetApp).toBe(true);
        expect(header.retries).toBe(2);
        expect(header.stepRetries).toBe(3);
        expect(header.video).toBe(true);
        expect(header.env).toEqual({ USER: 'alice' });
    });

    test('throws when appId is missing', () => {
        expect(() =>
            FlowParser.parse(flow('platform: ios', '- launchApp')),
        ).toThrow(/appId/);
    });

    test('throws when platform is missing', () => {
        expect(() =>
            FlowParser.parse(flow('appId: com.example.app', '- launchApp')),
        ).toThrow(/platform/);
    });

    test('throws when platform is invalid', () => {
        expect(() =>
            FlowParser.parse(flow('appId: com.example.app\nplatform: windows', '- launchApp')),
        ).toThrow(/platform/);
    });

    test('throws when document separator is missing', () => {
        expect(() => FlowParser.parse('appId: com.example.app\nplatform: ios')).toThrow(/separator/);
    });

    test('udid from YAML is ignored in favour of runtime override', () => {
        const yaml = flow('appId: com.example.app\nplatform: ios\nudid: yaml-udid', '- launchApp');
        const { header } = FlowParser.parse(yaml, { udid: 'runtime-udid' });
        expect(header.udid).toBe('runtime-udid');
    });

    test('udid from YAML is silently dropped when no runtime override provided', () => {
        const yaml = flow('appId: com.example.app\nplatform: ios\nudid: yaml-udid', '- launchApp');
        const { header } = FlowParser.parse(yaml);
        // YAML-sourced udid must NOT end up in header.udid
        expect(header.udid).toBeUndefined();
    });

    test('runtime udid override is applied', () => {
        const { header } = FlowParser.parse(
            flow(MINIMAL_HEADER, '- launchApp'),
            { udid: '00008110-ABC123' },
        );
        expect(header.udid).toBe('00008110-ABC123');
    });
});

// ---------------------------------------------------------------------------
// FlowParser — step parsing
// ---------------------------------------------------------------------------

describe('FlowParser.parse — steps', () => {
    test('parses no-value bare-string steps', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, [
            '- launchApp',
            '- restartApp',
            '- clearApp',
            '- stopApp',
            '- clearText',
            '- hideKeyboard',
            '- back',
            '- home',
        ].join('\n')));
        expect(steps.map(s => s.kind)).toEqual([
            'launchApp', 'restartApp', 'clearApp', 'stopApp',
            'clearText', 'hideKeyboard', 'back', 'home',
        ]);
    });

    test('parses tapOn with plain text', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- tapOn: "Submit"'));
        expect(steps[0]).toEqual({ kind: 'tapOn', target: 'Submit' });
    });

    test('parses tapOn with testId object', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- tapOn:\n    testId: submit-btn'));
        expect(steps[0]).toEqual({ kind: 'tapOn', target: { testId: 'submit-btn' } });
    });

    test('parses tapOn with id object', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- tapOn:\n    id: btn_login'));
        expect(steps[0]).toEqual({ kind: 'tapOn', target: { id: 'btn_login' } });
    });

    test('parses tapOn with xpath object', () => {
        const xpath = "//XCUIElementTypeButton[@name='OK']";
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, `- tapOn:\n    xpath: "${xpath}"`));
        expect(steps[0]).toEqual({ kind: 'tapOn', target: { xpath } });
    });

    test('parses inputText', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- inputText: "hello world"'));
        expect(steps[0]).toEqual({ kind: 'inputText', text: 'hello world' });
    });

    test('parses scroll direction', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- scroll: down'));
        expect(steps[0]).toEqual({ kind: 'scroll', direction: 'down' });
    });

    test('parses scrollTo', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- scrollTo: "Terms of Service"'));
        expect(steps[0]).toEqual({ kind: 'scrollTo', target: 'Terms of Service' });
    });

    test('parses swipe', () => {
        const { steps } = FlowParser.parse(
            flow(MINIMAL_HEADER, '- swipe:\n    from: [500, 1400]\n    to: [500, 400]'),
        );
        expect(steps[0]).toEqual({ kind: 'swipe', from: [500, 1400], to: [500, 400] });
    });

    test('parses assertVisible', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- assertVisible: "Welcome"'));
        expect(steps[0]).toEqual({ kind: 'assertVisible', target: 'Welcome' });
    });

    test('parses assertNotVisible', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- assertNotVisible: "Error"'));
        expect(steps[0]).toEqual({ kind: 'assertNotVisible', target: 'Error' });
    });

    test('parses assertEqual', () => {
        const { steps } = FlowParser.parse(
            flow(MINIMAL_HEADER, '- assertEqual:\n    id: label\n    value: OK'),
        );
        expect(steps[0]).toEqual({ kind: 'assertEqual', id: 'label', value: 'OK' });
    });

    test('parses waitForVisible', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- waitForVisible: "Dashboard"'));
        expect(steps[0]).toEqual({ kind: 'waitForVisible', target: 'Dashboard' });
    });

    test('parses waitForNotVisible', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- waitForNotVisible: "Loading..."'));
        expect(steps[0]).toEqual({ kind: 'waitForNotVisible', target: 'Loading...' });
    });

    test('parses wait', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- wait: 1500'));
        expect(steps[0]).toEqual({ kind: 'wait', ms: 1500 });
    });

    test('parses screenshot', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- screenshot: after-login'));
        expect(steps[0]).toEqual({ kind: 'screenshot', name: 'after-login' });
    });

    test('parses runScript', () => {
        const { steps } = FlowParser.parse(flow(MINIMAL_HEADER, '- runScript: scripts/seed.sh'));
        expect(steps[0]).toEqual({ kind: 'runScript', script: 'scripts/seed.sh' });
    });

    test('throws on unknown step type (object form)', () => {
        expect(() =>
            FlowParser.parse(flow(MINIMAL_HEADER, '- unknownStep: "value"')),
        ).toThrow(/unknown step type.*unknownStep/i);
    });

    test('throws on unknown step type (string form)', () => {
        expect(() =>
            FlowParser.parse(flow(MINIMAL_HEADER, '- unknownBareStep')),
        ).toThrow(/unknown step type.*unknownBareStep/i);
    });

    test('throws when step object has multiple keys', () => {
        expect(() =>
            FlowParser.parse(flow(MINIMAL_HEADER, '- tapOn: "X"\n  inputText: "Y"')),
        ).toThrow(/exactly one key/i);
    });
});

// ---------------------------------------------------------------------------
// FlowParser — env interpolation in steps
// ---------------------------------------------------------------------------

describe('FlowParser.parse — env interpolation', () => {
    test('interpolates $VAR from header.env into step text', () => {
        const yaml = flow(
            [MINIMAL_HEADER, 'env:', '  USERNAME: alice'].join('\n'),
            '- inputText: "$USERNAME"',
        );
        const { steps } = FlowParser.parse(yaml);
        expect(steps[0]).toEqual({ kind: 'inputText', text: 'alice' });
    });

    test('interpolates ${VAR} syntax', () => {
        const yaml = flow(
            [MINIMAL_HEADER, 'env:', '  HOST: staging.example.com'].join('\n'),
            '- inputText: "https://${HOST}/login"',
        );
        const { steps } = FlowParser.parse(yaml);
        expect(steps[0]).toEqual({ kind: 'inputText', text: 'https://staging.example.com/login' });
    });

    test('runtime env overrides header.env', () => {
        const yaml = flow(
            [MINIMAL_HEADER, 'env:', '  USERNAME: alice'].join('\n'),
            '- inputText: "$USERNAME"',
        );
        const { steps } = FlowParser.parse(yaml, { env: { USERNAME: 'bob' } });
        expect(steps[0]).toEqual({ kind: 'inputText', text: 'bob' });
    });

    test('interpolates string values inside tapOn object target', () => {
        const yaml = flow(
            [MINIMAL_HEADER, 'env:', '  BTN: submit-btn'].join('\n'),
            '- tapOn:\n    testId: "$BTN"',
        );
        const { steps } = FlowParser.parse(yaml);
        expect(steps[0]).toEqual({ kind: 'tapOn', target: { testId: 'submit-btn' } });
    });

    test('leaves unknown vars as-is without throwing', () => {
        const yaml = flow(MINIMAL_HEADER, '- inputText: "$UNDEFINED_VAR"');
        // Should NOT throw — just leave placeholder
        const { steps } = FlowParser.parse(yaml, { env: {} });
        // process.env might accidentally contain UNDEFINED_VAR in some environments,
        // so we just assert it doesn't throw and the step is produced
        expect(steps[0].kind).toBe('inputText');
    });
});

// ---------------------------------------------------------------------------
// EnvInterpolator — unit tests
// ---------------------------------------------------------------------------

describe('EnvInterpolator.interpolate', () => {
    test('replaces $VAR', () => {
        expect(interpolate('hello $NAME', { NAME: 'world' })).toBe('hello world');
    });

    test('replaces ${VAR}', () => {
        expect(interpolate('hello ${NAME}', { NAME: 'world' })).toBe('hello world');
    });

    test('replaces multiple vars in one string', () => {
        expect(interpolate('$A and $B', { A: 'foo', B: 'bar' })).toBe('foo and bar');
    });

    test('replaces ${VAR} inside a URL', () => {
        expect(interpolate('https://${HOST}/path', { HOST: 'example.com' })).toBe(
            'https://example.com/path',
        );
    });

    test('leaves unknown $VAR as-is', () => {
        expect(interpolate('$UNKNOWN', {})).toBe('$UNKNOWN');
    });

    test('leaves unknown ${VAR} as-is', () => {
        expect(interpolate('${UNKNOWN}', {})).toBe('${UNKNOWN}');
    });

    test('returns plain string unchanged', () => {
        expect(interpolate('no vars here', {})).toBe('no vars here');
    });

    test('does not double-replace $VAR that resolves to another $VAR pattern', () => {
        // The resolved value should NOT be re-interpolated
        expect(interpolate('$A', { A: '$B', B: 'surprise' })).toBe('$B');
    });
});

describe('EnvInterpolator.buildEnv', () => {
    test('merges headerEnv over process.env', () => {
        const env = buildEnv({ MY_VAR: 'header' });
        expect(env['MY_VAR']).toBe('header');
    });

    test('overrides win over headerEnv and process.env', () => {
        const env = buildEnv({ X: 'header' }, { X: 'override' });
        expect(env['X']).toBe('override');
    });

    test('handles undefined headerEnv gracefully', () => {
        expect(() => buildEnv(undefined)).not.toThrow();
    });
});
