// @ts-nocheck -- lots of type errors. low prio b/c proposals are like scripts
import { E } from '@endo/far';
import { makeStorageNodeChild, assertPathSegment } from '@agoric/internal/src/lib-chainStorage.js';
import { makeTracer } from '@agoric/internal';

import { unitAmount } from '@agoric/zoe/src/contractSupport/priceQuote.js';
import { reserveThenDeposit, reserveThenGetNames } from '@agoric/inter-protocol/src/proposals/utils.js';

const trace = makeTracer('RunPriceFeed', true);

/** @type {(name: string) => string} */
const sanitizePathSegment = name => {
    const candidate = name.replace(/ /g, '_');
    assertPathSegment(candidate);
    return candidate;
};

/**
 * @typedef {{
 * brandIn?: ERef<Brand<'nat'> | undefined>,
 * brandOut?: ERef<Brand<'nat'> | undefined>,
 * IN_BRAND_NAME: string,
 * IN_BRAND_DECIMALS: string,
 * OUT_BRAND_NAME: string,
 * OUT_BRAND_DECIMALS: string,
 * }} PriceFeedOptions
 */

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
            b = await E(agoricNames).provideInertBrand(name, harden({ decimalPlaces: parseInt(decimals, 10) }));
        }
        oracleBrandProduce[name].resolve(b);
    };

    return Promise.all([
        updateFreshBrand(rawBrandIn, IN_BRAND_NAME, IN_BRAND_DECIMALS),
        updateFreshBrand(rawBrandOut, OUT_BRAND_NAME, OUT_BRAND_DECIMALS),
    ]);
};

/**
 * @param {ChainBootstrapSpace} powers
 * @param {{options: {priceFeedOptions: {AGORIC_INSTANCE_NAME: string, oracleAddresses: string[], contractTerms: import('@agoric/inter-protocol/src/price/fluxAggregatorKit.js').ChainlinkConfig, IN_BRAND_NAME: string, OUT_BRAND_NAME: string}}}} config
 */
export const createPriceFeed = async (
    {
        consume: {
            agoricNamesAdmin,
            board,
            chainStorage,
            chainTimerService,
            client,
            econCharterKit,
            highPrioritySendersManager,
            namesByAddressAdmin,
            priceAuthority,
            priceAuthorityAdmin,
            startGovernedUpgradable,
        },
        produce: { priceFeedKit },
    },
    {
        options: {
            priceFeedOptions: { AGORIC_INSTANCE_NAME, oracleAddresses, contractTerms, IN_BRAND_NAME, OUT_BRAND_NAME },
        },
    },
) => {
    trace('createPriceFeed');
    const STORAGE_PATH = 'priceFeed';

    void E(client).assignBundle([_addr => ({ priceAuthority })]);

    const timer = await chainTimerService;

    /**
     * Values come from economy-template.json, which at this writing had IN:ATOM, OUT:USD
     *
     * @type {[[Brand<'nat'>, Brand<'nat'>], [Installation<import('@agoric/inter-protocol/src/price/fluxAggregatorContract.js').prepare>]]}
     */
    const [[brandIn, brandOut], [priceAggregator]] = await Promise.all([
        reserveThenGetNames(E(agoricNamesAdmin).lookupAdmin('oracleBrand'), [IN_BRAND_NAME, OUT_BRAND_NAME]),
        reserveThenGetNames(E(agoricNamesAdmin).lookupAdmin('installation'), ['priceAggregator']),
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

    const label = sanitizePathSegment(AGORIC_INSTANCE_NAME);

    const storageNode = await makeStorageNodeChild(chainStorage, STORAGE_PATH);
    const marshaller = await E(board).getReadonlyMarshaller();

    trace('awaiting startInstance');
    const faKit = await E(startGovernedUpgradable)({
        governedParams: {},
        privateArgs: {
            highPrioritySendersManager: await highPrioritySendersManager,
            marshaller,
            namesByAddressAdmin,
            storageNode: await E(storageNode).makeChildNode(label),
        },
        terms,
        label,
        installation: priceAggregator,
    });

    E(E(agoricNamesAdmin).lookupAdmin('instance'))
        .update(AGORIC_INSTANCE_NAME, faKit.instance)
        .catch(err => console.error(`🚨 failed to update ${AGORIC_INSTANCE_NAME}`, err));

    E(E.get(econCharterKit).creatorFacet).addInstance(faKit.instance, faKit.governorCreatorFacet, AGORIC_INSTANCE_NAME);
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
    const addOracle = async addr => {
        const invitation = await E(faKit.creatorFacet).makeOracleInvitation(addr);
        await reserveThenDeposit(`${AGORIC_INSTANCE_NAME} member ${addr}`, namesByAddressAdmin, addr, [invitation]);
    };

    trace('distributing invitations', oracleAddresses);
    await Promise.all(oracleAddresses.map(addOracle));

    // Add priceAuthorityAdmin to priceFeedKit so it can be used for the arbitrage bot
    priceFeedKit.reset();
    priceFeedKit.resolve(
        harden({
            fakeAtomPriceAuthority: priceAuthority,
            fakeAtomPriceAuthorityAdmin: priceAuthorityAdmin,
        }),
    );

    trace('createPriceFeed complete');
};

const t = 'priceFeed';
/**
 * Add a price feed to a running chain, returning the manifest, installations, and options.
 *
 * @param {object} utils
 * @param {(ref: unknown) => Promise<unknown>} [utils.restoreRef]
 * @param {PriceFeedOptions} priceFeedOptions
 */
export const getManifestForPriceFeed = async ({ restoreRef }, priceFeedOptions) => ({
    manifest: {
        [createPriceFeed.name]: {
            consume: {
                agoricNamesAdmin: t,
                board: t,
                chainStorage: t,
                chainTimerService: t,
                client: t,
                contractGovernor: t,
                econCharterKit: t,
                economicCommitteeCreatorFacet: t,
                highPrioritySendersManager: t,
                namesByAddressAdmin: t,
                priceAuthority: t,
                priceAuthorityAdmin: t,
                startGovernedUpgradable: t,
            },
            produce: {
                priceFeedKit: t,
            },
        },
        [ensureOracleBrands.name]: {
            namedVat: {
                consume: { agoricNames: 'agoricNames' },
            },
            oracleBrand: {
                produce: t,
            },
        },
    },
    installations: {
        priceAggregator: restoreRef(priceFeedOptions.priceAggregatorRef),
    },
    options: {
        priceFeedOptions: {
            brandIn: priceFeedOptions.brandInRef && restoreRef(priceFeedOptions.brandInRef),
            brandOut: priceFeedOptions.brandOutRef && restoreRef(priceFeedOptions.brandeOutRef),
            ...priceFeedOptions,
        },
    },
});
