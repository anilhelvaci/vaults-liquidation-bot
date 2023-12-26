import { Far } from '@endo/far';

/** @type {ContractStartFn} */
const start = async (zcf) => {
  const { keyword, assetKind, displayInfo } = zcf.getTerms();

  const mint = await zcf.makeZCFMint(keyword, assetKind, displayInfo);
  const { issuer } = mint.getIssuerRecord();

  const mintHook = async (userSeat) => {
    const {
      want: { [keyword]: wantedAmount },
    } = userSeat.getProposal();

    mint.mintGains(harden({ [keyword]: wantedAmount }), userSeat);

    userSeat.exit();
    return 'your offer was successful';
  };

  const makeMintInvitation = () => {
    return zcf.makeInvitation(mintHook, 'Mint asset');
  };

  const creatorFacet = Far('creatorFacet', {
    shutdown: () => zcf.shutdown(),
  });
  const publicFacet = Far('publicFacet', {
    makeMintInvitation,
    getIssuer: () => issuer,
  });

  return harden({ creatorFacet, publicFacet });
};

harden(start);
export { start };
