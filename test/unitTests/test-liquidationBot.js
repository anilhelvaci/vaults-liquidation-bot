// @ts-ignore
import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { makeTestContext, makeTestDriver } from './setup.js';
import { makeMockArbitrager, makeTestSuite } from '../tools.js';
import { headValue } from '@agoric/smart-wallet/test/supports.js';
import { makeRatioFromAmounts } from '@agoric/zoe/src/contractSupport/ratio.js';
import { E } from '@endo/far';
import { eventLoopIteration } from '@agoric/internal/src/testing-utils.js';
import { natSafeMath } from '@agoric/zoe/src/contractSupport/safeMath.js';

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
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS, startPriceVal: 1_100_000n });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const { bidManager } = makeMockArbitrager(suite, utils);

    // 350 - 300 * (1,1 * 1,05) = 3,5 Bid and 300 Collateral in payouts
    const { offerId, states } = bidManager.placeBid({
        bidAmount: suite.makeBid(350n),
        maxColAmount: suite.makeCollateral(300n),
        price: makeRatioFromAmounts(suite.makeBid(350n), suite.makeCollateral(300n)),
    });
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

test.serial('placed-bid-settles-percentage-strategy', async t => {
    const suite = makeTestSuite(t.context);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    // Use percentage strategy
    const { arbitrageManager, startArbing } = makeMockArbitrager(suite, utils, 2);
    startArbing(); // currentPrice = externalPrice * 1,05
    await eventLoopIteration();

    await suite.advanceTo(175n); // currentPrice = externalPrice
    await eventLoopIteration();

    await suite.advanceTo(180n); // currentPrice = externalPrice * 0,95
    await eventLoopIteration();

    await suite.advanceTo(185n); // currentPrice = externalPrice * 0,9 - Now we should see a bid, delta = 6%
    await eventLoopIteration();

    const bidLog = await Promise.all(arbitrageManager.getBidLog());
    const noBids = bidLog.slice(0, 3);
    const [placedBid, _] = bidLog.slice(-2);

    t.log('Bid Log', bidLog);

    const rates = [105n, 100n, 95n];
    [...noBids].forEach((bid, index) => {
        t.deepEqual(bid.msg, 'No Bid');
        t.like(bid.data, {
            bookState: {
                currentPriceLevel: makeRatioFromAmounts(
                    suite.makeBid(natSafeMath.multiply(natSafeMath.floorDivide(7_850_000n, 100n), rates[index])),
                    suite.makeCollateral(1_000_000n),
                ),
            },
        });
    });

    t.deepEqual(placedBid.msg, 'Bid Placed');
    t.like(placedBid.data, {
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(natSafeMath.multiply(natSafeMath.floorDivide(7_850_000n, 100n), 90)),
            suite.makeCollateral(1_000_000n),
        ),
        worstDesiredPrice: makeRatioFromAmounts(
            suite.makeBid(
                natSafeMath.multiply(natSafeMath.floorDivide(7_850_000n, 100n), 94), // delta = 6%
            ),
            suite.makeCollateral(1_000_000n),
        ),
    });

    const walletState = await headValue(utils.updateSub);
    t.like(walletState, {
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            payouts: {
                Bid: suite.makeBid(4n),
                Collateral: suite.makeCollateral(14154281n),
            },
        },
    });
});

test.serial('placed-bid-throws', async t => {
    const suite = makeTestSuite(t.context);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS, startPriceVal: 1_100_000n });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const { bidManager } = makeMockArbitrager(suite, utils);

    // 350 - 300 * (1,1 * 1,05) = 3,5 Bid and 300 Collateral in payouts
    const { states } = bidManager.placeBid({
        bidAmount: suite.makeBid(350_000_000n), // Exceed amount present in wallet
        maxColAmount: suite.makeCollateral(30_000_000n),
        minColAmount: suite.makeCollateral(35_000_000n),
        price: makeRatioFromAmounts(suite.makeBid(350n), suite.makeCollateral(300n)),
    });
    await t.throwsAsync(Promise.all(states));
});

test.serial('placed-bid-cancel', async t => {
    const suite = makeTestSuite(t.context);
    const { utils } = await suite.initWorld({
        bidderAddress: BIDDER_ADDRESS,
        startPriceVal: 1_100_000n,
        depositColValue: 10n,
    });

    await suite.advanceTo(170n); // Start next auction

    const { bidManager } = makeMockArbitrager(suite, utils);

    const { offerId } = bidManager.placeBid({
        bidAmount: suite.makeBid(350n),
        maxColAmount: suite.makeCollateral(300n),
        price: makeRatioFromAmounts(suite.makeBid(250n), suite.makeCollateral(300n)),
    });
    await eventLoopIteration();

    // Alice then decides to cancel her bid
    await t.notThrowsAsync(bidManager.cancelBid(offerId));

    // Check Alice gets refunded
    const walletState = await headValue(utils.updateSub);
    t.like(walletState, {
        updated: 'offerStatus',
        status: {
            id: offerId,
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            payouts: {
                Bid: suite.makeBid(350n),
            },
        },
    });
});

test.serial('arb-manager', async t => {
    const suite = makeTestSuite(t.context);
    const denomAmount = suite.makeCollateral(DENOM_VALUE);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const { startArbing, subs } = makeMockArbitrager(suite, utils);
    startArbing();

    await suite.advanceTo(175n);
    const clockUpdateOne = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateOne.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_850_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(180n);
    const clockUpdateTwo = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateTwo.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_457_500n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(185n);
    const clockUpdateThree = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateThree.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n - 14_154_281n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_065_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    const walletState = await headValue(utils.updateSub);
    console.log('WALLET_STATE: ', walletState);
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

test.serial('arb-manager-percentage-strategy', async t => {
    const suite = makeTestSuite(t.context);
    const denomAmount = suite.makeCollateral(DENOM_VALUE);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const { startArbing, subs } = makeMockArbitrager(suite, utils, 2);
    startArbing();

    await suite.advanceTo(175n);
    const clockUpdateOne = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateOne.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_850_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(180n);
    const clockUpdateTwo = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateTwo.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_457_500n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(185n);
    const clockUpdateThree = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateThree.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n - 14_154_281n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_065_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });
});

test.serial('arb-manager-controlled-spend', async t => {
    const suite = makeTestSuite(t.context);
    const denomAmount = suite.makeCollateral(DENOM_VALUE);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const { startArbing, subs } = makeMockArbitrager(suite, utils, 1);
    startArbing();

    await suite.advanceTo(175n);
    const clockUpdateOne = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateOne.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_850_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(180n);
    const clockUpdateTwo = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateTwo.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_457_500n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(185n);
    const clockUpdateThree = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateThree.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n - 1_415_428n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_065_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });
});

test.serial('arb-manager-controlled-spend-percentage', async t => {
    const suite = makeTestSuite(t.context);
    const denomAmount = suite.makeCollateral(DENOM_VALUE);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const { startArbing, subs } = makeMockArbitrager(suite, utils, 3);
    startArbing();

    await suite.advanceTo(175n);
    const clockUpdateOne = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateOne.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_850_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(180n);
    const clockUpdateTwo = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateTwo.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n - 1_340_931n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_457_500n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    await suite.advanceTo(185n);
    const clockUpdateThree = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateThree.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n - 2_756_359n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_065_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });
});

test.serial('arb-manager-cannot-fetch-external', async t => {
    const suite = makeTestSuite(t.context);
    const denomAmount = suite.makeCollateral(DENOM_VALUE);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    const { startArbing, subs, externalManager, arbitrageManager } = makeMockArbitrager(suite, utils);
    startArbing();
    externalManager.setShouldSuccess(false); // Promise for external price request rejects

    await suite.advanceTo(175n);
    await suite.advanceTo(180n);
    await suite.advanceTo(185n);
    const clockUpdateThree = await E(subs.bookSub).getUpdateSince();
    t.deepEqual(clockUpdateThree.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_065_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
        proceedsRaised: undefined,
        remainingProceedsGoal: null,
        startCollateral: suite.makeCollateral(50_000_000n),
        startPrice: makeRatioFromAmounts(suite.makeBid(7_850_000n), denomAmount),
        startProceedsGoal: null,
    });

    const bidLog = arbitrageManager.getBidLog();
    (await Promise.all([...bidLog])).map(bid =>
        t.deepEqual(bid, {
            msg: 'Error when fetching market price',
            data: new Error('MockReject'),
        }),
    );
});
