import { OpenAPIV3 } from 'openapi-types';

export const swaggerSpec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
        title: 'PhoneFarm Agent API',
        version: '1.0.0',
        description: 'Node.js agent HTTP API for Android/iOS device control via ADB / WDA.',
    },
    paths: {
        '/api/goog/device/pid': {
            post: {
                summary: 'Get scrcpy server PID for a device',
                tags: ['Device'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['udid'],
                                properties: {
                                    udid: { type: 'string', description: 'ADB serial of the device' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'PID returned', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, pid: { type: 'number' } } } } } },
                    '400': { description: 'Invalid udid' },
                    '404': { description: 'PID not found' },
                    '500': { description: 'Server error' },
                },
            },
        },
        '/api/goog/device/config': {
            post: {
                summary: 'Update scrcpy video settings for a device',
                tags: ['Device'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['udid', 'videoSettings'],
                                properties: {
                                    udid: { type: 'string' },
                                    videoSettings: {
                                        type: 'object',
                                        properties: {
                                            crop: { type: 'object', properties: { left: { type: 'number' }, top: { type: 'number' }, right: { type: 'number' }, bottom: { type: 'number' } } },
                                            bounds: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Video settings updated' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/goog/device/restart': {
            post: {
                summary: 'Restart scrcpy server on one or more devices',
                tags: ['Device'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    udid: { type: 'string' },
                                    udids: { type: 'array', items: { type: 'string' } },
                                    pid: { type: 'number', description: 'Optional; resolved automatically if omitted' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'All devices restarted' },
                    '207': { description: 'Partial success' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/goog/device/send-binary': {
            post: {
                summary: 'Send a raw binary payload to devices via an ADB-forwarded WebSocket',
                tags: ['Device'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['dataBase64'],
                                properties: {
                                    udid: { type: 'string' },
                                    udids: { type: 'array', items: { type: 'string' } },
                                    remote: { type: 'string', default: 'tcp:8886' },
                                    dataBase64: { type: 'string', description: 'Base64-encoded binary payload' },
                                    path: { type: 'string', description: 'WebSocket sub-path', default: '' },
                                    timeoutMs: { type: 'number', default: 5000 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Payload sent to all devices' },
                    '207': { description: 'Partial success' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/goog/device/install-apk': {
            post: {
                summary: 'Save a base64-encoded APK/XAPK to the upload directory',
                tags: ['APK'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['udid', 'dataBase64'],
                                properties: {
                                    udid: { type: 'string' },
                                    dataBase64: { type: 'string' },
                                    fileName: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'File saved', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, filePath: { type: 'string' } } } } } },
                    '400': { description: 'Validation error' },
                    '500': { description: 'Save failed' },
                },
            },
        },
        '/api/goog/device/install-apk-binary': {
            post: {
                summary: 'Save a raw binary APK/XAPK upload to the upload directory',
                description: 'Send binary body with headers: X-UDID, X-Filename, X-File-Size.',
                tags: ['APK'],
                parameters: [
                    { in: 'header', name: 'X-UDID', required: true, schema: { type: 'string' } },
                    { in: 'header', name: 'X-Filename', schema: { type: 'string' } },
                    { in: 'header', name: 'X-File-Size', schema: { type: 'integer' } },
                ],
                requestBody: {
                    required: true,
                    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
                },
                responses: {
                    '200': { description: 'File saved' },
                    '400': { description: 'Validation or size mismatch error' },
                    '500': { description: 'Save failed' },
                },
            },
        },
        '/api/goog/device/install-uploaded': {
            post: {
                summary: 'Install a previously uploaded APK/XAPK on a single device via ADB',
                tags: ['APK'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['udid', 'filePath'],
                                properties: {
                                    udid: { type: 'string' },
                                    filePath: { type: 'string', description: 'Path returned by install-apk or install-apk-binary' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Installed successfully' },
                    '400': { description: 'Validation error or path not allowed' },
                    '404': { description: 'File not found' },
                    '500': { description: 'Install failed' },
                },
            },
        },
        '/api/goog/device/install-bulk': {
            post: {
                summary: 'Install the same uploaded APK/XAPK on multiple devices in parallel',
                tags: ['APK'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['udids', 'filePath'],
                                properties: {
                                    udids: { type: 'array', items: { type: 'string' } },
                                    filePath: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'All devices installed' },
                    '207': { description: 'Partial success' },
                    '400': { description: 'Validation error' },
                    '404': { description: 'File not found' },
                },
            },
        },
        '/api/goog/device/connect-wifi': {
            post: {
                summary: 'Enable TCP/IP (WiFi ADB) mode and connect one or more devices',
                tags: ['Device'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    udid: { type: 'string' },
                                    udids: { type: 'array', items: { type: 'string' } },
                                    port: { type: 'number', default: 5555 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'All devices connected' },
                    '207': { description: 'Partial success' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/devices/connect': {
            post: {
                summary: 'Switch one or more devices between USB and WiFi connection mode',
                tags: ['Device'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                oneOf: [
                                    {
                                        type: 'object',
                                        required: ['device', 'connect'],
                                        properties: {
                                            device: { type: 'string' },
                                            connect: { type: 'string', enum: ['wifi', 'usb'] },
                                            port: { type: 'number' },
                                        },
                                    },
                                    {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                device: { type: 'string' },
                                                connect: { type: 'string', enum: ['wifi', 'usb'] },
                                                port: { type: 'number' },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Connection mode switched' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/device/keep-awake': {
            post: {
                summary: 'Prevent the device screen from sleeping for a given duration',
                tags: ['Device'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['device'],
                                properties: {
                                    device: { type: 'string' },
                                    seconds: { type: 'number', default: 30, description: 'Duration in seconds' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Keep-awake scheduled' },
                    '400': { description: 'Invalid device' },
                    '500': { description: 'Failed' },
                },
            },
        },
        '/api/recordings': {
            get: {
                summary: 'List all saved action recordings',
                tags: ['Recordings'],
                responses: {
                    '200': { description: 'Recording list returned' },
                    '500': { description: 'Failed to list recordings' },
                },
            },
        },
        '/api/recordings/start': {
            post: {
                summary: 'Begin recording user actions for an active WebSocket proxy session',
                tags: ['Recordings'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['session'],
                                properties: {
                                    session: { type: 'string' },
                                    recordId: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Recording started', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, recordId: { type: 'string' } } } } } },
                    '400': { description: 'Validation error' },
                    '404': { description: 'Session not found' },
                },
            },
        },
        '/api/recordings/stop': {
            post: {
                summary: 'Stop the active recording for a session and finalize the file',
                tags: ['Recordings'],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['session'], properties: { session: { type: 'string' } } } } },
                },
                responses: {
                    '200': { description: 'Recording stopped' },
                    '400': { description: 'Validation error' },
                    '404': { description: 'Session not found' },
                },
            },
        },
        '/api/recordings/run': {
            post: {
                summary: 'Replay a saved recording on an active WebSocket proxy session',
                tags: ['Recordings'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['session', 'recordId'],
                                properties: {
                                    session: { type: 'string' },
                                    recordId: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Playback started' },
                    '400': { description: 'Validation error' },
                    '404': { description: 'Session not found' },
                },
            },
        },
        '/api/recordings/pause': {
            post: {
                summary: 'Pause an active recording or playback on a session',
                tags: ['Recordings'],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['session'], properties: { session: { type: 'string' } } } } },
                },
                responses: {
                    '200': { description: 'Paused', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, mode: { type: 'string' } } } } } },
                    '400': { description: 'Validation error' },
                    '404': { description: 'Session not found' },
                },
            },
        },
        '/api/recordings/resume': {
            post: {
                summary: 'Resume a paused recording or playback on a session',
                tags: ['Recordings'],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['session'], properties: { session: { type: 'string' } } } } },
                },
                responses: {
                    '200': { description: 'Resumed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, mode: { type: 'string' } } } } } },
                    '400': { description: 'Validation error' },
                    '404': { description: 'Session not found' },
                },
            },
        },
        '/api/recordings/update-name': {
            post: {
                summary: 'Rename a saved recording',
                tags: ['Recordings'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['recordId', 'name'],
                                properties: {
                                    recordId: { type: 'string' },
                                    name: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Renamed' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/recordings/delete': {
            post: {
                summary: 'Delete a saved recording by ID',
                tags: ['Recordings'],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', required: ['recordId'], properties: { recordId: { type: 'string' } } } } },
                },
                responses: {
                    '200': { description: 'Deleted' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/sync': {
            get: {
                summary: 'List the current device sync mappings (target → sync devices)',
                tags: ['Sync'],
                responses: {
                    '200': { description: 'Sync mappings returned' },
                    '500': { description: 'Failed' },
                },
            },
        },
        '/api/sync/set': {
            post: {
                summary: 'Set a sync mapping so actions on target devices are mirrored to sync devices',
                tags: ['Sync'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['target_device', 'sync_devices'],
                                properties: {
                                    target_device: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
                                    sync_devices: { type: 'array', items: { type: 'string' } },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Mapping set' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/sync/clear': {
            post: {
                summary: 'Remove all device sync mappings',
                tags: ['Sync'],
                responses: {
                    '200': { description: 'All mappings cleared' },
                    '400': { description: 'Failed' },
                },
            },
        },
    },
};
