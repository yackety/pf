import { runFlow } from './helpers/runFlow';

describe('Android', () => {
    it('browsing', async () => {
        const uuid = '988a1b313954434b5930';
        await runFlow({
            yml: 'flows/browsing.yml',
            udid: uuid,
        });
    });
});
