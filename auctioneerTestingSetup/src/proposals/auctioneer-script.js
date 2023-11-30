import { makeHelpers } from '@agoric/deploy-script-support';
import { getManifestForInitAuctioneer } from './auctioneer-proposal.js';

export const defaultProposalBuilder = async ({ publishRef, install }) => {

  return harden({
    sourceSpec: './auctioneer-proposal.js',
    getManifestCall: [
        getManifestForInitAuctioneer.name,
      {
        contractRef: publishRef(install('@agoric/inter-protocol/src/auction/auctioneer.js')),
      },
    ],
  });
};

export default async (homeP, endowments) => {
  const helperEndowments = {
    ...endowments,
    cacheDir: endowments.pathResolve(process.cwd(), 'cache/auctioneer'),
  };

  const { writeCoreProposal } = await makeHelpers(homeP, helperEndowments);
  await writeCoreProposal('startAuctioneer', defaultProposalBuilder);
};