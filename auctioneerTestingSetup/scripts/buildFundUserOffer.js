import '@endo/init';
import { makeSmokeTestMarshaller } from './smokeTestMarshaller.js';
import { AmountMath } from '@agoric/ertp';

const main = () => {
    const { serialize, instances, assets } = makeSmokeTestMarshaller();
    // const { atomFaucetInstance: instance } = instances;
    const keyword = 'FakeATOM';
    const value = 1000000n * 10n ** 6n;

    const { brand } = assets[keyword];

    const wantedAmount = AmountMath.make(brand, harden(value));

    //console.log('Log ... ', wantedAmount);

    const spendAction = {
        method: 'executeOffer',
        offer: {
            id: `makeFundOffer${Date.now()}`,
            invitationSpec: {
                source: 'agoricContract',
                instancePath: [`fakeATOMFaucet`],
                callPipe: [['makeMintInvitation']],
            },
            proposal: {
                want: {
                    [keyword]: wantedAmount,
                },
            },
        },
    };

    process.stdout.write(JSON.stringify(serialize(harden(spendAction))));
    process.stdout.write('\n');
};

main();
