// @ts-ignore
import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { makeTestContext, makeTestDriver } from './setup.js';
import { makeMockArbitrager, makeTestSuite } from '../tools.js';
import { headValue } from '@agoric/smart-wallet/test/supports.js';
import { makeRatioFromAmounts } from '@agoric/zoe/src/contractSupport/ratio.js';
import { E } from '@endo/far';
import { eventLoopIteration } from '@agoric/internal/src/testing-utils.js';
import { natSafeMath } from '@agoric/zoe/src/contractSupport/safeMath.js';
import { StateManagerKeys } from '../../src/constants.js';
import { AmountMath } from '@agoric/ertp/src/index.js';
import { makeRatio } from '@agoric/ui-components/src/ratio.js';
import { ratioGTE } from '@agoric/zoe/src/contractSupport/index.js';

const BIDDER_ADDRESS = 'agoricBidder';
const BASE_POINTS = 10_000n;
const DENOM_VALUE = 1_000_000n;

const isWithinOneBips = (t, compareAmount, baseAmount) => {
    t.truthy(
        ratioGTE(
            makeRatio(1n, compareAmount.brand, BASE_POINTS),
            makeRatioFromAmounts(AmountMath.subtract(compareAmount, baseAmount), baseAmount),
        ),
    );
};

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
    t.log('schedule', schedules.nextAuctionSchedule);
    await suite.advanceTo(170n); // Start next auction

    const { startArbing, subs, stateManager, arbitrageManager } = makeMockArbitrager(suite, utils, 1);
    startArbing();

    await suite.advanceTo(175n);
    await eventLoopIteration();

    const {
        [StateManagerKeys.CREDIT_MANAGER]: { getCredit },
    } = stateManager.getState();

    await suite.advanceTo(180n);
    await eventLoopIteration();

    const clockUpdateOne = await E(subs.bookSub).getUpdateSince();
    t.like(clockUpdateOne.value, {
        collateralAvailable: suite.makeCollateral(50_000_000n - 3_352_329n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_457_500n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
    });

    const [placedBidOne] = (await Promise.all(arbitrageManager.getBidLog())).slice(-2);
    const creditOne = getCredit();
    t.is(placedBidOne.msg, 'Bid Placed');
    t.like(placedBidOne.data, {
        offerId: 'place-bid-0',
        bidUtils: {
            bidAmount: suite.makeBid(25_000_000n),
        },
    });

    // Make sure the difference is less than 1 bips
    isWithinOneBips(t, creditOne, suite.makeBid(75_000_000n));

    await suite.advanceTo(185n);
    await eventLoopIteration();

    const clockUpdateTwo = await E(subs.bookSub).getUpdateSince();
    t.like(clockUpdateTwo.value, {
        collateralAvailable: suite.makeCollateral(46_647_671n - 3_538_570n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(7_065_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
    });

    const [placedBidTwo] = (await Promise.all(arbitrageManager.getBidLog())).slice(-2);
    t.is(placedBidTwo.msg, 'Bid Placed');
    t.like(placedBidTwo.data, {
        offerId: 'place-bid-1',
        bidUtils: {
            bidAmount: suite.makeBid(25_000_000n),
        },
    });

    // Make sure the difference is less than 1 bips
    const creditTwo = getCredit();
    isWithinOneBips(t, creditTwo, suite.makeBid(50_000_000n));

    await suite.advanceTo(190n);
    await eventLoopIteration();

    const clockUpdateThree = await E(subs.bookSub).getUpdateSince();
    t.like(clockUpdateThree.value, {
        collateralAvailable: suite.makeCollateral(43_109_101n - 3_746_721n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(6_672_500n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
    });

    const [placedBidThree] = (await Promise.all(arbitrageManager.getBidLog())).slice(-2);
    t.is(placedBidThree.msg, 'Bid Placed');
    t.like(placedBidThree.data, {
        offerId: 'place-bid-2',
        bidUtils: {
            bidAmount: suite.makeBid(25_000_000n),
        },
    });

    // Make sure the difference is less than 1 bips
    const creditThree = getCredit();
    isWithinOneBips(t, creditThree, suite.makeBid(25_000_000n));

    await suite.advanceTo(195n);
    await eventLoopIteration();

    const clockUpdateFour = await E(subs.bookSub).getUpdateSince();
    t.like(clockUpdateFour.value, {
        collateralAvailable: suite.makeCollateral(39_362_380n - 3_980_891n),
        currentPriceLevel: makeRatioFromAmounts(
            suite.makeBid(6_280_000n * BASE_POINTS),
            suite.makeCollateral(DENOM_VALUE * BASE_POINTS),
        ),
    });

    const [placeBidFour] = (await Promise.all(arbitrageManager.getBidLog())).slice(-2);
    t.is(placeBidFour.msg, 'Bid Placed');
    t.like(placeBidFour.data, {
        offerId: 'place-bid-3',
        bidUtils: {
            bidAmount: suite.makeBid(25_000_000n),
        },
    });

    // Make sure the difference is less than 1 bips
    const creditFour = getCredit();
    t.falsy(AmountMath.isGTE(creditFour, suite.makeBid(25_000_000n)));

    await suite.advanceTo(200n);
    await eventLoopIteration();

    const [insufficientCreditBid] = (await Promise.all(arbitrageManager.getBidLog())).slice(-1);
    t.is(insufficientCreditBid.msg, 'Insufficient credit');
    t.falsy(AmountMath.isGTE(insufficientCreditBid.data.credit, suite.makeBid(25_000_000n)));
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

test.serial('auction-round-finishes-then-restarts', async t => {
    const suite = makeTestSuite(t.context);
    const { utils } = await suite.initWorld({ bidderAddress: BIDDER_ADDRESS });
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n ends at 205n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    t.is(schedules.nextAuctionSchedule?.endTime.absValue, 205n);
    await suite.advanceTo(170n); // Start next auction

    // Use percentage strategy
    const { arbitrageManager, startArbing, externalManager, stateManager } = makeMockArbitrager(suite, utils);
    externalManager.setPrice(1_000_000n);
    startArbing(); // currentPrice = externalPrice * 1,05
    await eventLoopIteration();

    await suite.advanceTo(175n); // currentPrice = externalPrice
    await eventLoopIteration();

    await suite.advanceTo(180n); // currentPrice = externalPrice * 0,95
    await eventLoopIteration();

    await suite.advanceTo(185n); // currentPrice = externalPrice * 0,9 - Now we should see a bid, delta = 6%
    await eventLoopIteration();

    await suite.advanceTo(190n); // currentPrice = externalPrice * 0,85 - Now we should see a bid, delta = 6%
    await eventLoopIteration();

    await suite.advanceTo(195n); // currentPrice = externalPrice * 0,8 - Now we should see a bid, delta = 6%
    await eventLoopIteration();

    await suite.advanceTo(200n); // currentPrice = externalPrice * 0,75 - Now we should see a bid, delta = 6%
    await eventLoopIteration();

    await suite.advanceTo(205n); // currentPrice = externalPrice * 0,7 - Now we should see a bid, delta = 6%
    await eventLoopIteration();

    const bidLog = await Promise.all(arbitrageManager.getBidLog());
    const noState = bidLog.pop();

    t.log('Bid Log', bidLog);
    t.log('No state', noState);

    const rates = [105n, 100n, 95n, 90n, 85n, 80n, 75n, 70n, 1n, 1n];
    [...bidLog].forEach((bid, index) => {
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

    t.deepEqual(noState.msg, 'State not initialized');
    t.like(noState.data, {
        bookState: {
            currentPriceLevel: null,
        },
        scheduleState: {
            nextStartTime: {
                absValue: 250n
            }
        }
    });

    // Update the new price to something that is more than startPrice * 1,05
    externalManager.setPrice(8_843_000n);

    await suite.advanceTo(250n);
    const [placeBid] = (await Promise.all(arbitrageManager.getBidLog())).slice(-2);

    t.is(placeBid.msg, 'Bid Placed');
    t.like(placeBid.data, {
        offerId: 'place-bid-0',
    });
});
