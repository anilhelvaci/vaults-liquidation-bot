import { makeHelpers } from '@agoric/deploy-script-support';
import { defaultProposalBuilder as oraclesProposalBuilder } from './price-feed-core.js';

/** @type {import('@agoric/deploy-script-support/src/externalTypes.js').ProposalBuilder} */
export const fakeAtomOraclesProposalBuilder = async powers => {
    return oraclesProposalBuilder(powers, {
        AGORIC_INSTANCE_NAME: `FakeATOM-USD price feed`,
        IN_BRAND_LOOKUP: ['agoricNames', 'oracleBrand', 'FakeATOM'],
        IN_BRAND_DECIMALS: 6,
        OUT_BRAND_LOOKUP: ['agoricNames', 'oracleBrand', 'USD'],
        OUT_BRAND_DECIMALS: 4,
        oracleAddresses: [
            // copied from decentral-main-vaults-config.json
            'agoric1krunjcqfrf7la48zrvdfeeqtls5r00ep68mzkr',
            'agoric19uscwxdac6cf6z7d5e26e0jm0lgwstc47cpll8',
            'agoric144rrhh4m09mh7aaffhm6xy223ym76gve2x7y78',
            'agoric19d6gnr9fyp6hev4tlrg87zjrzsd5gzr5qlfq2p',
            'agoric1n4fcxsnkxe4gj6e24naec99hzmc4pjfdccy5nj',
        ],
    });
};

export default async (homeP, endowments) => {
    const helperEndowments = {
        ...endowments,
        cacheDir: endowments.pathResolve(process.cwd(), 'cache/oracle'),
    };
    const { writeCoreProposal } = await makeHelpers(homeP, helperEndowments);
    await writeCoreProposal('startFakeAtomOracle', fakeAtomOraclesProposalBuilder);
};
