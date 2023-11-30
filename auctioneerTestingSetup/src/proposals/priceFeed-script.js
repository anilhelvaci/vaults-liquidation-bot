import { makeHelpers } from '@agoric/deploy-script-support';
import { getManifestForInitPriceFeed } from './priceFeed-proposal.js';

const DEFAULT_CONTRACT_TERMS = {
  POLL_INTERVAL: 30n,
  maxSubmissionCount: 1000,
  minSubmissionCount: 2,
  restartDelay: 1,
  timeout: 10,
  minSubmissionValue: 1n,
  maxSubmissionValue: 2n ** 256n,
};

export const defaultProposalBuilder = async (
  { publishRef, install },
  options = {},
) => {
  const {
    brandIn,
    brandOut,
    contractTerms,
    AGORIC_INSTANCE_NAME,
    IN_BRAND_LOOKUP,
    OUT_BRAND_LOOKUP,
    IN_BRAND_NAME,
    OUT_BRAND_NAME,
    oracleAddresses,
    ...optionsRest
  } = options;

  return harden({
    sourceSpec: './priceFeed-proposal.js',
    getManifestCall: [
        getManifestForInitPriceFeed.name,
      {
        ...optionsRest,
        AGORIC_INSTANCE_NAME,
        contractTerms,
        oracleAddresses,
        IN_BRAND_LOOKUP,
        OUT_BRAND_LOOKUP,
        IN_BRAND_NAME,
        OUT_BRAND_NAME,
        priceAggregatorRef: publishRef(
          install(
            '@agoric/inter-protocol/src/price/fluxAggregatorContract.js',
          ),
        ),
      },
    ],
  });
};

export default async (homeP, endowments) => {
  const { lookup } = endowments;

  const contractTerms = DEFAULT_CONTRACT_TERMS;
  const AGORIC_INSTANCE_NAME = 'ATOM-USD price feed';
  const IN_BRAND_NAME = 'ATOM';
  const OUT_BRAND_NAME = 'USD';
  const IN_BRAND_DECIMALS = parseInt(6, 10);
  const OUT_BRAND_DECIMALS = parseInt(6, 10);
  const IN_BRAND_LOOKUP = JSON.stringify(['wallet', 'brand', 'ATOM']);
  const OUT_BRAND_LOOKUP = JSON.stringify([
    'agoricNames',
    'oracleBrand',
    'USD',
  ]);
  const inLookup = JSON.parse(IN_BRAND_LOOKUP);
  const outLookup = JSON.parse(OUT_BRAND_LOOKUP);
  const brandIn = lookup(inLookup).catch(() => undefined);
  const brandOut = lookup(outLookup).catch(() => undefined);
  const oracleAddresses = [                                     // identify correct address to use
    '@PRIMARY_ADDRESS@',
    'agoric1dy0yegdsev4xvce3dx7zrz2ad9pesf5svzud6y',
  ]; 

  console.log('Log script: ', await lookup(inLookup));

  const helperEndowments = {
    ...endowments,
    cacheDir: endowments.pathResolve(process.cwd(), 'cache/price-feed'),
  };

  const proposalBuilder = (powers) =>
    defaultProposalBuilder(powers, {
      AGORIC_INSTANCE_NAME,
      IN_BRAND_NAME,
      OUT_BRAND_NAME,
      IN_BRAND_DECIMALS,
      OUT_BRAND_DECIMALS,
      IN_BRAND_LOOKUP,
      OUT_BRAND_LOOKUP,
      oracleAddresses,
      brandIn,
      brandOut,
      contractTerms,
    });

  const { writeCoreProposal } = await makeHelpers(homeP, helperEndowments);
  await writeCoreProposal('startPriceFeed', proposalBuilder);
};

// brandInRef: brandIn && publishRef(brandIn),
// brandOutRef: brandOut && publishRef(brandOut),