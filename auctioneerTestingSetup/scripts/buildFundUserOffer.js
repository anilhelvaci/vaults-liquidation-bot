import '@endo/init';
import { makeSmokeTestMarshaller } from './smokeTestMarshaller.js';

const main = () => {
  const { serialize, instances } = makeSmokeTestMarshaller();
  const { atomFaucetInstance: instance } = instances;

  const spendAction = {
    method: 'executeOffer',
    offer: {
      id: `makeFundOffer${Date.now()}`,
      invitationSpec: {
        source: 'contract',
        instance,
        publicInvitationMaker: 'makeMintInvitation',
      },
      offerArgs: {
        value: 100n,
      },
    },
  };

  process.stdout.write(JSON.stringify(serialize(harden(spendAction))));
  process.stdout.write('\n');
};

main();
