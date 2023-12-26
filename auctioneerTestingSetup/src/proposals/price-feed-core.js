const DEFAULT_CONTRACT_TERMS = {
  POLL_INTERVAL: 30n,
  maxSubmissionCount: 1000,
  minSubmissionCount: 2,
  restartDelay: 1, // the number of rounds an Oracle has to wait before they can initiate another round
  timeout: 10, // in seconds according to chainTimerService
  minSubmissionValue: 1n,
  maxSubmissionValue: 2n ** 256n,
};

/** @type {import('@agoric/deploy-script-support/src/externalTypes.js').ProposalBuilder} */
export const defaultProposalBuilder = async (
  { publishRef, install },
  options = {},
) => {
  const {
    brandIn,
    brandOut,
    contractTerms = DEFAULT_CONTRACT_TERMS,
    AGORIC_INSTANCE_NAME,
    IN_BRAND_LOOKUP,
    OUT_BRAND_LOOKUP,
    IN_BRAND_NAME = IN_BRAND_LOOKUP[IN_BRAND_LOOKUP.length - 1],
    OUT_BRAND_NAME = OUT_BRAND_LOOKUP[OUT_BRAND_LOOKUP.length - 1],
    oracleAddresses,
    ...optionsRest
  } = options;

  assert(AGORIC_INSTANCE_NAME, 'AGORIC_INSTANCE_NAME is required');
  assert(Array.isArray(oracleAddresses), 'oracleAddresses array is required');

  if (!brandIn) {
    assert.equal(IN_BRAND_LOOKUP[0], 'agoricNames');
    assert(IN_BRAND_NAME);
  }
  if (!brandOut) {
    assert.equal(OUT_BRAND_LOOKUP[0], 'agoricNames');
    assert(OUT_BRAND_NAME);
  }

  return harden({
    sourceSpec: './price-feed-proposal.js',
    getManifestCall: [
      'getManifestForPriceFeed',
      {
        ...optionsRest,
        AGORIC_INSTANCE_NAME,
        contractTerms,
        oracleAddresses,
        IN_BRAND_LOOKUP,
        OUT_BRAND_LOOKUP,
        IN_BRAND_NAME,
        OUT_BRAND_NAME,
        brandInRef: brandIn && publishRef(brandIn),
        brandOutRef: brandOut && publishRef(brandOut),
        priceAggregatorRef: publishRef(
          install(
            '@agoric/inter-protocol/src/price/fluxAggregatorContract.js',
            '../bundles/bundle-fluxAggregatorKit.js',
          ),
        ),
      },
    ],
  });
};