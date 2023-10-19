import { E, Far } from '@endo/far';
import buildManualTimer from "@agoric/zoe/tools/manualTimer.js";
import { installPuppetGovernance, produceInstallations, setupBootstrap } from "@agoric/inter-protocol/test/supports.js";
import { startEconomicCommittee } from "@agoric/inter-protocol/src/proposals/startEconCommittee.js";
import { setupReserve, startAuctioneer } from "@agoric/inter-protocol/src/proposals/econ-behaviors.js";
import { makeScalarMapStore } from "@agoric/store/src/stores/scalarMapStore.js";
import { providePriceAuthorityRegistry } from "@agoric/zoe/tools/priceAuthorityRegistry.js";
import { setUpZoeForTest } from "@agoric/zoe/tools/setup-zoe.js";
import { makeMockTestSpace, withAmountUtils } from "@agoric/smart-wallet/test/supports.js";
import { makeIssuerKit } from "@agoric/ertp/src/issuerKit.js";
import { allValues, deeplyFulfilledObject, objectMap } from "@agoric/internal/src/utils.js";

import bundleContractGovernor from "@agoric/governance/bundles/bundle-contractGovernor.js";
import bundleAssetReserve from "@agoric/boot/bundles/vaults/bundle-assetReserve.js";
import bundleAuctioneer from "@agoric/boot/bundles/vaults/bundle-auctioneer.js";
import { unsafeMakeBundleCache } from "@agoric/swingset-vat/tools/bundleTool.js";
import { resolve as importMetaResolve } from 'import-meta-resolve';
import { eventLoopIteration } from "@agoric/notifier/tools/testSupports.js";
import { makeManualPriceAuthority } from "@agoric/zoe/tools/manualPriceAuthority.js";
import { makeRatio } from "@agoric/zoe/src/contractSupport/ratio.js";
import { AmountMath } from "@agoric/ertp/src/amountMath.js";
import { BridgeId } from "@agoric/internal/src/config.js";
import { makeStorageNodeChild } from "@agoric/internal/src/lib-chainStorage.js";
import { makeFakeBankKit } from "../../_agstate/yarn-links/@agoric/vats/tools/bank-utils.js";
import { subscriptionTracker } from "../../_agstate/yarn-links/@agoric/inter-protocol/test/metrics.js";
import { subscribeEach } from "../../_agstate/yarn-links/@agoric/notifier/src/subscribe.js";
import { NonNullish } from "../../_agstate/yarn-links/@agoric/assert/src/assert.js";

const defaultParams = {
    StartFrequency: 40n,
    ClockStep: 5n,
    StartingRate: 10500n,
    LowestRate: 4500n,
    DiscountStep: 2000n,
    AuctionStartDelay: 10n,
    PriceLockPeriod: 3n,
};

export const makeTestContext = async () => {
    const { zoe, feeMintAccessP } = await setUpZoeForTest();

    const bid = withAmountUtils(makeIssuerKit('Bid'));
    const collateral = withAmountUtils(makeIssuerKit('Collateral'));

    const installs = await deeplyFulfilledObject(setUpInstallations(zoe));
    const feeMintAccess = await feeMintAccessP;

    return {
        zoe: await zoe,
        installs,
        run: bid,
        bid,
        feeMintAccess,
        collateral,
    };
};

const setUpInstallations = async zoe => {
    const [autoRefundPath, walletFactoryPath] = await Promise.all([
        getPath('@agoric/zoe/src/contracts/automaticRefund.js'),
        getPath('@agoric/smart-wallet/src/walletFactory.js'),
    ]);
    const bundleCache = await unsafeMakeBundleCache('./bundles/');

    const bundles = await allValues({
        autoRefund: bundleCache.load(autoRefundPath, 'AutoRefund'),
        walletFactory: bundleCache.load(walletFactoryPath, 'WalletFactory'),
        auctioneer: bundleAuctioneer,
        reserve: bundleAssetReserve,
        governor: bundleContractGovernor,
    });
    /** @type {AuctionTestInstallations} */
        // @ts-expect-error cast
    return objectMap(bundles, bundle => E(zoe).install(bundle));
};

const getPath = async packageName => {
    const url = await importMetaResolve(packageName, import.meta.url);
    return new URL(url).pathname;
};

const setupServices = async (t, params = defaultParams) => {
    const {
        zoe,
        electorateTerms = { committeeName: 'The Cabal', committeeSize: 1 },
        collateral,
    } = t.context;

    const timer = buildManualTimer();
    await timer.advanceTo(140n);

    const space = await setupBootstrap(t, timer);
    installPuppetGovernance(zoe, space.installation.produce);

    t.context.puppetGovernors = {
        auctioneer: E.get(space.consume.auctioneerKit).governorCreatorFacet,
        vaultFactory: E.get(space.consume.vaultFactoryKit).governorCreatorFacet,
    };

    // @ts-expect-error not all installs are needed for auctioneer.
    produceInstallations(space, t.context.installs);

    await startEconomicCommittee(space, electorateTerms);

    await setupReserve(space);
    const { creatorFacet: reserveCF } = await space.consume.reserveKit;

    void E(reserveCF).addIssuer(collateral.issuer, 'Collateral');

    const paBaggage = makeScalarMapStore();
    const { priceAuthority, adminFacet: registry } =
        providePriceAuthorityRegistry(paBaggage);
    space.produce.priceAuthority.resolve(priceAuthority);

    const [walletFactoryDriver] = await Promise.all([
        startWalletFactory(t, space),
        startAuctioneer(space, { auctionParams: params })
    ]);
    return { space, timer, registry, walletFactoryDriver };
};

const startWalletFactory = async (t, { consume }) => {
    const { zoe, installs } = t.context;
    const bankManager = getBankManager(t);

    const [storageNode, walletBridgeManager, assetPublisher, walletSpace] = await Promise.all([
        makeStorageNodeChild(
            consume.chainStorage,
            'wallet',
        ),
        getBridgeManager(),
        E(bankManager).getBankForAddress('anyAddress'),
        makeMockTestSpace(console.log)
    ]);

    const walletFactoryKit = await E(zoe).startInstance(
        installs.walletFactory,
        {},
        {
            agoricNames: consume.agoricNames,
            board: consume.board,
            assetPublisher,
        },
        { storageNode, walletBridgeManager },
    );

    return makeWalletFactoryDriver(t, walletFactoryKit, walletSpace);
};

const getBankManager = t => {
    const { bid, collateral } = t.context;
    const fakeBankKit = makeFakeBankKit([bid, collateral]);
    return Far(
        'mockBankManager',
        {
            getBankForAddress: _a => fakeBankKit.bank,
        }
    );
};

const getBridgeManager = async () => {
    const {
        consume: {
            bridgeManager: bridgeManagerP,
        }
    } = await makeMockTestSpace(console.log);
    const bridgeManager = await bridgeManagerP;

    return await (bridgeManager &&
        E(bridgeManager).register(BridgeId.WALLET));
};

const makeWalletFactoryDriver = (t, walletFactoryKit, { consume }) => {
    const bankManager = getBankManager(t);
    const simpleProvideWallet = async address => {
        // copied from makeClientBanks()
        const bank = E(bankManager).getBankForAddress(address);

        const [wallet, _isNew] = await E(
            walletFactoryKit.creatorFacet,
        ).provideSmartWallet(address, bank, consume.namesByAddressAdmin);
        return wallet;
    };

    return harden({
        ...walletFactoryKit,
        simpleProvideWallet,
    });
};

export const makeTestDriver = async (t, params = defaultParams) => {
    const { zoe, bid } = t.context;
    /** @type {MapStore<Brand, { setPrice: (r: Ratio) => void }>} */
    const priceAuthorities = makeScalarMapStore();

    const { space, timer, registry, walletFactoryDriver } = await setupServices(t, params);
    // Each driver needs its own mockChainStorage to avoid state pollution between tests
    const mockChainStorage =
        /** @type {import('@agoric/internal/src/storage-test-utils.js').MockChainStorageRoot} */ (
        await space.consume.chainStorage
    );
    const { auctioneerKit: auctioneerKitP } = space.consume;
    const auctioneerKit = await auctioneerKitP;

    const { publicFacet, creatorFacet } = auctioneerKit;

    const depositCollateral = async (collateralAmount, issuerKit, offerArgs) => {
        const collateralPayment = E(issuerKit.mint).mintPayment(
            harden(collateralAmount),
        );
        const seat = E(zoe).offer(
            E(publicFacet).makeDepositInvitation(),
            harden({
                give: { Collateral: collateralAmount },
            }),
            harden({ Collateral: collateralPayment }),
            offerArgs,
        );
        await eventLoopIteration();

        return seat;
    };

    /** @type {MapStore<Brand, BookDataTracker>} */
    const bookDataTrackers = makeScalarMapStore('trackers');

    /**
     * @param {Brand} brand
     * @returns {Promise<BookDataTracker>}
     */
    const getBookDataTracker = async brand => {
        if (bookDataTrackers.has(brand)) {
            return bookDataTrackers.get(brand);
        }

        /** @type {Promise<BookDataTracker>} */
        const tracker = E.when(
            E(publicFacet).getBookDataUpdates(brand),
            subscription => subscriptionTracker(t, subscribeEach(subscription)),
        );
        // @ts-expect-error I don't know what it wants.
        bookDataTrackers.init(brand, tracker);
        return tracker;
    };

    /**
     * @param {Pick<IssuerKit<'nat'>, 'brand' | 'issuer' | 'mint'>} issuerKit
     * @param {Amount<'nat'>} collateralAmount
     * @param {{ goal: Amount<'nat'> }} [limit]
     */
    const setupCollateralAuction = async (issuerKit, collateralAmount, limit) => {
        const collateralBrand = collateralAmount.brand;

        const pa = makeManualPriceAuthority({
            actualBrandIn: collateralBrand,
            actualBrandOut: bid.brand,
            timer,
            initialPrice: makeRatio(100n, bid.brand, 100n, collateralBrand),
        });
        priceAuthorities.init(collateralBrand, pa);
        await registry.registerPriceAuthority(pa, collateralBrand, bid.brand, true);

        await E(creatorFacet).addBrand(
            issuerKit.issuer,
            collateralBrand.getAllegedName(),
        );

        /** @type {BookDataTracker} */
        const tracker = await getBookDataTracker(collateralBrand);
        await tracker.assertInitial({
            collateralAvailable: AmountMath.makeEmpty(collateralBrand),
            currentPriceLevel: null,
            proceedsRaised: undefined,
            remainingProceedsGoal: null,
            startCollateral: AmountMath.makeEmpty(collateralBrand),
            startPrice: null,
            startProceedsGoal: null,
        });

        return depositCollateral(collateralAmount, issuerKit, limit);
    };

    return harden({
        auctionDriver: {
            mockChainStorage,
            publicFacet,
            creatorFacet,
            setupCollateralAuction,
            async advanceTo(time, wait) {
                await timer.advanceTo(time);
                if (wait) {
                    await eventLoopIteration();
                }
            },
            setGovernedParam: (name, newValue) => {
                trace(t, 'setGovernedParam', name);
                const auctionGov = NonNullish(t.context.puppetGovernors.auctioneer);
                return E(auctionGov).changeParams(
                    harden({ changes: { [name]: newValue } }),
                );
            },
            async updatePriceAuthority(newPrice) {
                priceAuthorities.get(newPrice.denominator.brand).setPrice(newPrice);
                await eventLoopIteration();
            },
            depositCollateral,
            getSchedule() {
                return E(publicFacet).getSchedules();
            },
            getTimerService() {
                return timer;
            },
            getScheduleTracker() {
                return E.when(E(publicFacet).getScheduleUpdates(), subscription =>
                    subscriptionTracker(t, subscribeEach(subscription)),
                );
            },
            getBookDataTracker,
        },
        walletFactoryDriver,
    });
};