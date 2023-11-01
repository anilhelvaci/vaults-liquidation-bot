// @ts-ignore

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { makeTestContext, makeTestDriver } from './setup.js';
import {
    makeMockAuctionWatcher, makeMockExternalManager,
    makeSmartWalletOfferSender,
    makeTestSuite,
} from '../tools.js';
import { makeBidManager } from '../../src/bidManager.js';
import { headValue } from '@agoric/smart-wallet/test/supports.js';
import { eventLoopIteration } from "@agoric/notifier/tools/testSupports.js";
import { makeArbitrager } from "../../src/arbitrager.js";
import { makeArbitrageManager } from '../../src/arbitrageManager.js';
import { makeAuctionStateManager } from '../../src/auctionState.js';
import { StateManagerKeys } from '../../src/constants.js';
import { getConfig } from '../../src/helpers.js';
import { AmountMath } from '@agoric/ertp';
import { makeRatioFromAmounts } from '@agoric/zoe/src/contractSupport/ratio.js';
import { E } from '@endo/far';

const BIDDER_ADDRESS = 'agoricBidder';
const BASE_POINTS = 10_000n;
const DENOM_VALUE = 1_000_000n;

test.before(async t => {
    t.context = await makeTestContext();
});

test.beforeEach(async t => {
    t.context.drivers = await makeTestDriver(t);
    console.log('----------------- TEST LOGS -----------------');
});

test('initial', async t => {
    const { drivers } = t.context;
    console.log({ drivers });
    t.pass();
});

test.serial('placed-bid-settles', async t => {
    const suite = makeTestSuite(t.context);
    const { utils } = await suite.provideWalletAndUtils(BIDDER_ADDRESS);
    await suite.setupCollateralAuction();
    await suite.fundBid(utils.depositFacet, 1000n);

    const offerSender = makeSmartWalletOfferSender(utils.offersFacet);
    const bidManager = makeBidManager(
        {
            collateralBrand: suite.getCollateralBrand(),
            bidBrand: suite.getBidBrand(),
        },
        offerSender,
    );
    t.log(bidManager);

    await suite.updateCollateralPrice(11n);
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    // 350 - 300 * (1,1 * 1,05) = 3,5 Bid and 300 Collateral in payouts
    const { offerId, states } = bidManager.placeBid(350n, 300n);
    await Promise.all(states);

    const walletState = await headValue(utils.updateSub);
    t.like(walletState, {
        updated: 'offerStatus',
        status: {
            id: offerId,
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            payouts: {
                Bid: suite.makeBid(3n),
                Collateral: suite.makeCollateral(300n),
            },
        },
    });
});

test.serial('arb-manager', async t => {
    const suite = makeTestSuite(t.context);
    const { utils } = await suite.provideWalletAndUtils(BIDDER_ADDRESS);
    await suite.setupCollateralAuction(50_000_000n);
    const config = getConfig();
    await suite.fundBid(utils.depositFacet, config.credit);

    await suite.updateCollateralPrice(7_850_000n); // 1 ATOM = 7.85 IST
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const bidBrand = suite.getBidBrand();
    const colBrand = suite.getCollateralBrand();
    const denomAmount = suite.makeCollateral(DENOM_VALUE);

    const subs = suite.getSubscribersForWatcher();
    const arbWatcher = makeMockAuctionWatcher({ ...subs, walletUpdateSub: utils.updateSub });
    const stateManager = makeAuctionStateManager();
    const offerSender = makeSmartWalletOfferSender(utils.offersFacet);
    const bidManager = makeBidManager(
        {
            collateralBrand: colBrand,
            bidBrand,
        },
        offerSender,
    );
    const externalManager = makeMockExternalManager(bidBrand, colBrand);
    const arbitrageManager = makeArbitrageManager(stateManager.getState, externalManager, bidManager);
    const notify = (type, data) => {
        stateManager.updateState(type, data);
        arbitrageManager.onStateUpdate(type);
    };

    notify(StateManagerKeys.BID_BRAND, suite.getBidBrand());
    notify(StateManagerKeys.COLLATERAL_BRAND, suite.getCollateralBrand());

    arbWatcher.watch(notify);

    await suite.advanceTo(175n);
    const clockUpdateOne = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateOne.value, {
        collateralAvailable: AmountMath.make(colBrand, 50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(suite.makeBid(7_850_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS)),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: AmountMath.make(colBrand, 50_000_000n),
        startPrice: makeRatioFromAmounts(AmountMath.make(bidBrand, 7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(180n);
    const clockUpdateTwo = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateTwo.value, {
        collateralAvailable: AmountMath.make(colBrand, 50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(suite.makeBid(7_457_500n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS)),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: AmountMath.make(colBrand, 50_000_000n),
        startPrice: makeRatioFromAmounts(AmountMath.make(bidBrand, 7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(185n);
    const clockUpdateThree = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateThree.value, {
        collateralAvailable: AmountMath.make(colBrand, 50_000_000n - 14_154_281n),
        currentPriceLevel: makeRatioFromAmounts(suite.makeBid(7_065_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS)),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: AmountMath.make(colBrand, 50_000_000n),
        startPrice: makeRatioFromAmounts(AmountMath.make(bidBrand, 7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    const walletState = await headValue(utils.updateSub);
    t.like(walletState, {
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            payouts: {
                Collateral: suite.makeCollateral(14154281n),
            },
        },
    });
});
