import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['**/*.spec.ts'],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.json' }],
    },
    globalSetup: './setup/globalSetup.ts',
    globalTeardown: './setup/globalTeardown.ts',
    maxWorkers: process.env.DEVICE_COUNT ? Number(process.env.DEVICE_COUNT) : 1,
    testTimeout: 300_000,
    reporters: [
        'default',
        ['jest-junit', {
            outputDirectory: './reports',
            outputName: 'junit.xml',
        }],
        ['jest-html-reporters', {
            publicPath: './reports',
            filename: 'report.html',
            openReport: false,
        }],
        './reporter/StepReporter.ts',
    ],
    forceExit: true,
};

export default config;
