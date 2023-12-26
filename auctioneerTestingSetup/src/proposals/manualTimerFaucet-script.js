import { makeHelpers } from '@agoric/deploy-script-support';
import { getManifestForInitManualTimerFaucet } from './manualTimerFaucet-proposal.js';

export const defaultProposalBuilder = async ({ publishRef, install }) => {
    return harden({
        sourceSpec: './manualTimerFaucet-proposal.js',
        getManifestCall: [
            getManifestForInitManualTimerFaucet.name,
            {
                contractRef: publishRef(install('../manualTimerFaucet.js')),
            },
        ],
    });
};

export default async (homeP, endowments) => {
    const helperEndowments = {
        ...endowments,
        cacheDir: endowments.pathResolve(process.cwd(), 'cache/manual-timer'),
    };

    const { writeCoreProposal } = await makeHelpers(homeP, helperEndowments);
    await writeCoreProposal('startManualTimer', defaultProposalBuilder);
};
