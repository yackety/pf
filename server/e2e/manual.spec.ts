import { runFlow } from './helpers/runFlow';

describe('Android', () => {
    it('browsing', () => {
        const uuid = '988a1b313954434b5930';
        runFlow({
            yml: 'flows/browsing.yml',
            udid: uuid,
        });
    });
});
