// @ts-nocheck -- lots of type errors. low prio b/c proposals are like scripts
import { E } from '@endo/far';
import { makeTracer } from '@agoric/internal';
import { unitAmount } from '@agoric/zoe/src/contractSupport/priceQuote.js';
import { reserveThenGetNames } from '@agoric/inter-protocol/src/proposals/utils.js';

const trace = makeTracer('FakePriceFeed');

/**
 * Create inert brands (no mint or issuer) referred to by price oracles.
 *
 * @param {ChainBootstrapSpace & NamedVatPowers} space
 * @param {{options: {priceFeedOptions: PriceFeedOptions}}} opt
 * @returns {Promise<[Brand<'nat'>, Brand<'nat'>]>}
 */
export const ensureOracleBrands = async (
  {
    namedVat: {
      consume: { agoricNames },
    },
    oracleBrand: { produce: oracleBrandProduce },
  },
  {
    options: {
      priceFeedOptions: {
        brandIn: rawBrandIn,
        brandOut: rawBrandOut,
        IN_BRAND_NAME,
        IN_BRAND_DECIMALS,
        OUT_BRAND_NAME,
        OUT_BRAND_DECIMALS,
      },
    },
  },
) => {
  trace('ensureOracleBrands');

  const updateFreshBrand = async (brand, name, decimals) => {
    let b = await brand;
    if (!b) {
      // not 1st await
      // eslint-disable-next-line @jessie.js/no-nested-await
      b = await E(agoricNames).provideInertBrand(
        name,
        harden({ decimalPlaces: parseInt(decimals, 10) }),
      );
    }
    oracleBrandProduce[name].resolve(b);
  };

  return Promise.all([
    updateFreshBrand(rawBrandIn, IN_BRAND_NAME, IN_BRAND_DECIMALS),
    updateFreshBrand(rawBrandOut, OUT_BRAND_NAME, OUT_BRAND_DECIMALS),
  ]);
};

export const createPriceFeed = async (powers, options) => {
  trace('createPriceFeed...');

  const {
    consume: {
      zoe,
      agoricNamesAdmin,
      board,
      chainStorage,
      chainTimerService,
      client,
      contractGovernor,
      econCharterKit,
      economicCommitteeCreatorFacet,
      highPrioritySendersManager,
      namesByAddressAdmin,
      priceAuthority,
      priceAuthorityAdmin,
      startGovernedUpgradable,
    },
    produce: { priceAggregatorKit },
    installation: {
      consume: { priceAggregatorInstallation },
    },
    instance: {
      produce: { priceAggregatorInstance },
    },
  } = powers;

  const {
    AGORIC_INSTANCE_NAME,
    oracleAddresses,
    contractTerms,
    IN_BRAND_NAME,
    OUT_BRAND_NAME,
  } = options.priceFeedOptions;

  const timer = await chainTimerService;
  const marshaller = await E(board).getPublishingMarshaller();
  const storageNode = await E(chainStorage).makeChildNode('fakePriceFeed');

  void E(client).assignBundle([(_addr) => ({ priceAuthority })]);

  /**
   * Values come from economy-template.json, which at this writing had IN:ATOM, OUT:USD
   *
   * @type {[[Brand<'nat'>, Brand<'nat'>], [Installation<import('@agoric/inter-protocol/src/price/fluxAggregatorContract.js').prepare>]]}
   */
  const [[brandIn, brandOut], [priceAggregator]] = await Promise.all([
    reserveThenGetNames(E(agoricNamesAdmin).lookupAdmin('oracleBrand'), [
      IN_BRAND_NAME,
      OUT_BRAND_NAME,
    ]),
    reserveThenGetNames(E(agoricNamesAdmin).lookupAdmin('installation'), [
      'priceAggregator',
    ]),
  ]);

  const unitAmountIn = await unitAmount(brandIn);
  const terms = harden({
    ...contractTerms,
    description: AGORIC_INSTANCE_NAME,
    brandIn,
    brandOut,
    timer,
    unitAmountIn,
  });
  trace('got terms');

  const label = AGORIC_INSTANCE_NAME;

  trace('awaiting startInstance');
  const faKit = await E(startGovernedUpgradable)({
    governedParams: {},
    privateArgs: {
      highPrioritySendersManager: await highPrioritySendersManager,
      marshaller,
      namesByAddressAdmin,
      storageNode: await E(storageNode).makeChildNode('ATOM-USD_price_feed'),
    },
    terms,
    label,
    installation: priceAggregator,
  });

  priceAggregatorKit.reset();
  priceAggregatorKit.resolve(faKit)

  E(E.get(econCharterKit).creatorFacet).addInstance(
    faKit.instance,
    faKit.governorCreatorFacet,
    AGORIC_INSTANCE_NAME,
  );
  trace('registered', AGORIC_INSTANCE_NAME, faKit.instance);

  // Publish price feed in home.priceAuthority.
  const forceReplace = true;
  void E(priceAuthorityAdmin).registerPriceAuthority(
    E(faKit.publicFacet).getPriceAuthority(),
    brandIn,
    brandOut,
    forceReplace,
  );

  /**
   * Initialize a new oracle and send an invitation to administer it.
   *
   * @param {string} addr
   */
  const addOracle = async (addr) => {
    const invitation = await E(faKit.creatorFacet).makeOracleInvitation(addr);
    await reserveThenDeposit(
      `${AGORIC_INSTANCE_NAME} member ${addr}`,
      namesByAddressAdmin,
      addr,
      [invitation],
    );
  };

  trace('distributing invitations', oracleAddresses);
  await Promise.all(oracleAddresses.map(addOracle));
  trace('createPriceFeed complete');
};

export const getManifestForInitPriceFeed = async (
  { restoreRef },
  priceFeedOptions,
) =>
  harden({
    manifest: {
      [createPriceFeed.name]: {
        consume: {
          zoe: 'zoe',
          agoricNamesAdmin: true,
          board: true,
          chainStorage: true,
          chainTimerService: true,
          client: true,
          contractGovernor: true,
          econCharterKit: true,
          economicCommitteeCreatorFacet: true,
          highPrioritySendersManager: true,
          namesByAddressAdmin: true,
          priceAuthority: true,
          priceAuthorityAdmin: true,
          startGovernedUpgradable: true,
        },
        produce: {
          priceAggregatorKit: true,
        },
        installation: {
          consume: {
            priceAggregatorInstallation: true,
          },
        },
        instance: {
          produce: {
            priceAggregatorInstance: true,
          },
        },
      },
      [ensureOracleBrands.name]: {
        namedVat: {
          consume: {
            agoricNames: true,
          },
        },
        oracleBrand: {
          produce: {
            oracleBrandProduce: true,
          },
        },
      },
    },
    installations: {
      priceAggregator: restoreRef(priceFeedOptions.priceAggregatorRef),
    },
    options: {
      priceFeedOptions: {
        brandIn:
          priceFeedOptions.brandInRef &&
          restoreRef(priceFeedOptions.brandInRef),
        brandOut:
          priceFeedOptions.brandOutRef &&
          restoreRef(priceFeedOptions.brandOutRef),
        ...priceFeedOptions,
      },
    },
  });
