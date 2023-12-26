import { makeHelpers } from '@agoric/deploy-script-support';
import { getManifestForGetPriceFeedKit } from './getPriceAuthority-proposal.js';

export const defaultProposalBuilder = async () => {
    return harden({
        sourceSpec: './getPriceAuthority-proposal.js',
        getManifestCall: [getManifestForGetPriceFeedKit.name],
    });
};

export default async (homeP, endowments) => {
    const helperEndowments = {
        ...endowments,
        cacheDir: endowments.pathResolve(process.cwd(), 'cache/price-authority'),
    };

    const { writeCoreProposal } = await makeHelpers(homeP, helperEndowments);
    await writeCoreProposal('getPriceFeedKit', defaultProposalBuilder);
};
