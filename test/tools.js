import { E } from '@endo/far';
import { eventLoopIteration } from '@agoric/notifier/tools/testSupports.js';
import { makeRatioFromAmounts, makeRatio } from '@agoric/zoe/src/contractSupport/ratio.js';
import { subscribeEach } from "@agoric/notifier";
import { StateManagerKeys } from '../src/constants.js';
import { getConfig, setBookState } from '../src/helpers.js';
import { makeAuctionStateManager } from '../src/auctionState.js';
import { makeBidManager } from '../src/bidManager.js';
import { makeArbitrageManager } from '../src/arbitrageManager.js';

const makeSmartWalletOfferSender = (
    offersFacet,
    eventLoopCallback = eventLoopIteration,
) => {
    const send = async offerSpec => {
        await E(offersFacet).executeOffer(offerSpec);
        await eventLoopCallback();
    };

    return harden({
        send,
    });
};
harden(makeSmartWalletOfferSender);

const getSmartWalletUtils = async smartWallet => {
    const [depositFacet, offersFacet, currentSub, updateSub] =
        await Promise.all([
            E(smartWallet).getDepositFacet(),
            E(smartWallet).getOffersFacet(),
            E(smartWallet).getCurrentSubscriber(),
            E(smartWallet).getUpdatesSubscriber(),
        ]);

    return harden({
        depositFacet,
        offersFacet,
        currentSub,
        updateSub,
    });
};

const makeTestSuite = context => {
    const {
        drivers: { auctionDriver, walletFactoryDriver },
        bid,
        collateral,
    } = context;

    const provideWalletAndUtils = async address => {
        const smartWallet =
            await walletFactoryDriver.simpleProvideWallet(address);
        const utils = await getSmartWalletUtils(smartWallet);

        return harden({ smartWallet, utils });
    };

    const setupCollateralAuction = (collateralValue = 1000n) => {
        return auctionDriver.setupCollateralAuction(
            collateral,
            collateral.make(collateralValue),
        );
    };

    const fundBid = (depositFacet, value) => {
        const bidPayment = bid.mint.mintPayment(bid.make(value));
        return E(depositFacet).receive(bidPayment);
    };

    const advanceTo = absValue => {
        return auctionDriver.advanceTo(absValue, 'wait');
    };

    /**
     * const price = newPrice / 10Col
     */
    const updateCollateralPrice = newPrice => {
        return auctionDriver.updatePriceAuthority(
            makeRatioFromAmounts(bid.make(newPrice), collateral.make(1_000_000n)),
        );
    };

    const getSubscribersForWatcher = () => {
        return harden({
            bookSub: E(auctionDriver.publicFacet).getBookDataUpdates(collateral.brand),
            govSub: E(auctionDriver.publicFacet).getSubscription(),
            scheduleSub: E(auctionDriver.publicFacet).getScheduleUpdates(),
        });
    };

    const initWorld = async ({
        bidderAddress,
        depositColValue = 50_000_000n,
        startPriceVal = 7_850_000n,
        configIndex = 0,
    }) => {
        const provisioned = await provideWalletAndUtils(bidderAddress);
        await setupCollateralAuction(depositColValue);
        const config = getConfig(configIndex);
        await fundBid(provisioned.utils.depositFacet, config.credit);

        await updateCollateralPrice(startPriceVal);

        return harden(provisioned);
    };

    return harden({
        provideWalletAndUtils,
        setupCollateralAuction,
        getCollateralBrand: () => collateral.brand,
        getBidBrand: () => bid.brand,
        fundBid,
        advanceTo,
        getAuctionSchedules: () => auctionDriver.getSchedule(),
        getTimerService: () => auctionDriver.getTimerService(),
        updateCollateralPrice,
        makeBid: value => bid.make(value),
        makeCollateral: value => collateral.make(value),
        getSubscribersForWatcher,
        getBookDataTracker: auctionDriver.getBookDataTracker,
        initWorld,
    });
};
harden(makeTestSuite);

const makeMockAuctionWatcher = ({ bookSub, govSub, scheduleSub, walletUpdateSub }) => {
    let notifier;
    const watch = (notify) => {
        notifier = notify;
        watchBook();
        watchGovernance();
        watchSchedule();
        watchSmartWallet();
    };

    const watchBook = async () => {
        for await (const bookUpdate of subscribeEach(bookSub)) {
            setBookState(notifier, bookUpdate);
        }
    };

    const watchGovernance = async () => {
        for await (const govUpdate of subscribeEach(govSub)) {
            notifier(StateManagerKeys.GOVERNANCE_STATE, govUpdate);
        }
    };

    const watchSchedule = async () => {
        for await (const scheduleUpdate of subscribeEach(scheduleSub)) {
            notifier(StateManagerKeys.SCHEDULE_STATE, scheduleUpdate);
        }
    };

    const watchSmartWallet = async () => {
        for await (const walletUpdate of subscribeEach(walletUpdateSub)) {
            notifier(StateManagerKeys.WALLET_UPDATE, walletUpdate);
        }
    };

    return harden({
        watch,
    });
};
harden(makeMockAuctionWatcher);

const makeMockExternalManager = (bidBrand, colBrand) => {
    let shouldSuccess = true;

    const fetchExternalPrice = () => {
        // ATOM price on 31-10-2023
        const mockPrice = makeRatio(
            7_850_000n,
            bidBrand,
            1_000_000n,
            colBrand,
        );

        return shouldSuccess ? Promise.resolve(mockPrice) : Promise.reject(new Error('MockReject'));
    };

    return harden({
        fetchExternalPrice,
        setShouldSuccess: result => shouldSuccess = result,
    });
};

const makeMockArbitrager = (suite, utils, configIndex) => {
    const subs = suite.getSubscribersForWatcher();
    const bidBrand = suite.getBidBrand();
    const colBrand = suite.getCollateralBrand();

    const arbConfig = getConfig(configIndex);

    const arbWatcher = makeMockAuctionWatcher({ ...subs, walletUpdateSub: utils.updateSub });
    const stateManager = makeAuctionStateManager(arbConfig);
    const offerSender = makeSmartWalletOfferSender(utils.offersFacet);
    const bidManager = makeBidManager(offerSender);
    const externalManager = makeMockExternalManager(bidBrand, colBrand);
    const arbitrageManager = makeArbitrageManager(stateManager.getState, externalManager, bidManager, arbConfig);
    const notify = (type, data) => {
        stateManager.updateState(type, data);
        arbitrageManager.onStateUpdate(type);
    };

    return harden({
        startArbing: () => arbWatcher.watch(notify),
        arbitrageManager,
        externalManager,
        bidManager,
        subs,
    })
};
harden(makeMockAuctionWatcher);

export {
    makeSmartWalletOfferSender,
    getSmartWalletUtils,
    makeTestSuite,
    makeMockAuctionWatcher,
    makeMockExternalManager,
    makeMockArbitrager,
};
