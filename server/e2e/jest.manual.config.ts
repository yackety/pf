/**
 * e2e/jest.manual.config.ts
 *
 * Lightweight Jest config for manual / Test Explorer runs.
 *
 * Key differences from jest.config.ts:
 *  - Only discovers manual.spec.ts (not the auto-glob AppiumFlowRunner.spec.ts)
 *  - No globalSetup / globalTeardown — each test manages its own Appium lifecycle
 *  - No jest-html-reporters (faster startup)
 */

import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['**/manual.spec.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.json' }],
    },
    testTimeout: 300_000,
    reporters: [
        'default',
        ['jest-junit', {
            outputDirectory: './reports',
            outputName: 'junit-manual.xml',
        }],
    ],
    forceExit: true,
};

export default config;
