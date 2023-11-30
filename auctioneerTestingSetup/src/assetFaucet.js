import { AmountMath } from '@agoric/ertp';
import { Far } from '@endo/marshal';

/** @type {ContractStartFn} */
const start = async (zcf) => {
  const { keyword, assetKind, displayInfo } = zcf.getTerms();

  const mint = await zcf.makeZCFMint(keyword, assetKind, displayInfo);
  const { issuer, brand } = mint.getIssuerRecord();

  const mintHook = async (userSeat, offerArgs) => {
    const { value } = offerArgs;
    const mintAmount = AmountMath.make(brand, value);
    mint.mintGains(harden({ [keyword]: mintAmount }), userSeat);

    userSeat.exit();
    return `An amount of ${value} ${keyword} was sent to your wallet.`;
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
