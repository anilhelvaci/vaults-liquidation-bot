import { makeHelpers } from '@agoric/deploy-script-support';
import { getManifestForInitAssetFaucet } from './assetFaucet-proposal.js';

export const defaultProposalBuilder = async ({ publishRef, install }) => {

  return harden({
    sourceSpec: './assetFaucet-proposal.js',
    getManifestCall: [
      getManifestForInitAssetFaucet.name,
      {
        contractRef: publishRef(install('../assetFaucet.js')),
      },
    ],
  });
};

export default async (homeP, endowments) => {
  const helperEndowments = {
    ...endowments,
    cacheDir: endowments.pathResolve(process.cwd(), 'cache/asset-faucet'),
  };

  const { writeCoreProposal } = await makeHelpers(homeP, helperEndowments);
  await writeCoreProposal('startAssetFaucet', defaultProposalBuilder);
};