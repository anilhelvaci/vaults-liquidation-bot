import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { makeMockExternalManager } from '../tools.js';
import { getConfig } from '../../src/helpers.js';
import { makeArbitrageManager } from '../../src/arbitrageManager.js';
import { makeAuctionStateManager } from '../../src/auctionState.js';
import { withAmountUtils } from '@agoric/smart-wallet/test/supports.js';
import { makeIssuerKit } from '@agoric/ertp';
import { MILI_SEC, StateManagerKeys } from '../../src/constants.js';
import {
    floorDivideBy,
    makeRatioFromAmounts,
} from '@agoric/zoe/src/contractSupport/index.js';

const makeMockBidManager = () => {
    let count = 0;
    const placeBid = bidUtils => {
        console.log('Place Bid Called', bidUtils);
        const offerId = `place-bid-${count}`;
        count += 1;
        return harden({ offerId });
    };
    
    return harden({
        placeBid,
    });
};

test.before(t => {
    const moola = withAmountUtils(makeIssuerKit('moola'));
    const simolean = withAmountUtils(makeIssuerKit('simolean'));

    const makePrice = numeratorVal => {
        return makeRatioFromAmounts(moola.make(numeratorVal), simolean.make(1_000_000n));
    };

    const rawConfig = getConfig();
    const config =  { ...rawConfig, retryInterval: 500 }; // Override config to retry on every .5 seconds
    const stateManager = makeAuctionStateManager(config);
    const externalManager = makeMockExternalManager(moola.brand, simolean.brand);
    const bidManager = makeMockBidManager();

    const arbitrageManager = makeArbitrageManager(stateManager.getState, externalManager, bidManager, config);

    const notify = (key, data) => {
        stateManager.updateState(key, data);
        arbitrageManager.onStateUpdate(key);
    };

    t.context = harden({
        moola,
        simolean,
        config,
        arbitrageManager,
        bidManager,
        externalManager,
        stateManager,
        notify,
        makePrice,
    });
});

test('initial', t => {
    const { arbitrageManager } = t.context;
    t.log(arbitrageManager);
    t.pass();
});

/**
 * 7_065_000n satisfies the delta for config index = 0
 *
 * We need to keep track of the bidLog when
 * - State not initialized +
 * - Insufficient credit +
 * - Existing bid +
 * - Placed bid +
 * - No bid +
 */
test('sequential', async t => {
    const { arbitrageManager, notify, stateManager, makePrice, moola, config } = t.context;

    // State is not initialized until a non-null state update is received  by stateManager
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: null });
    const bidLogInit = arbitrageManager.getBidLog();
    const uninitializedBidLog = await bidLogInit[0];
    t.deepEqual(uninitializedBidLog, { msg: 'State not initialized', data: stateManager.getState() });

    // initialize state
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_850_000n) });
    const bidLogNoBid = arbitrageManager.getBidLog();
    const noBidLog = await bidLogNoBid[1];
    t.deepEqual(noBidLog, {
        msg: 'No Bid',
        data: {
            ...stateManager.getState(),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        }
    });

    // Move the price so delta is satisfied
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_065_000n) });
    const placeBidLog = arbitrageManager.getBidLog();
    const bidLog = await placeBidLog[2];
    t.deepEqual(bidLog, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-0',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(7_065_000n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(7_065_000n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        }
    });

    // Someone else makes a bid, and we get notified, but we shouldn't bid because there's already a pending bid
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_065_000n) });
    const pendingBidLog = arbitrageManager.getBidLog();
    const pendingBid = await pendingBidLog[3];
    t.deepEqual(pendingBid, {
        msg:'Already existing bid. Either pending or success',
        data: {
            currentBid: {
                offerId: 'place-bid-0',
                state: 'pending'
            }
        }
    });

    // Send a wallet update to decrease credit
    notify(StateManagerKeys.WALLET_UPDATE, harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            proposal: { give: { Bid: moola.make(100_000_000n) } }, // Flash bid
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
        },
    }));

    // Now trigger maybePlaceBid again
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_065_000n) });
    const creditBidLog = arbitrageManager.getBidLog();
    const insufficientBid = await creditBidLog[4];
    t.deepEqual(insufficientBid, {
        msg: 'Insufficient credit',
        data: {
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(7_065_000n)),
                price: makePrice(7_350_000n),
            },
            credit: moola.makeEmpty(),
        },
    })
});

/**
 * - Can't fetch external price over the network
 * - Handle thrown exception and register a retry callback
 * - Retry three times unless
 *   - The wakeup time is before a new clock step in the auction
 * - If we get a success response within three retries we go on with the logic
 * - If not we wait for the next clock step
 */
test('retry-on-price-fetch-error', async t => {
    const { arbitrageManager, notify, makePrice, config, externalManager } = t.context;

    externalManager.setShouldSuccess(false); // Make sure external manager throws

    // initialize state
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_850_000n) });
    notify(StateManagerKeys.SCHEDULE_STATE, {
        nextDescendingStepTime: {
            absValue: BigInt(Date.now()) / MILI_SEC + 60n * MILI_SEC,
            timerBrand: {},
        },
    });
    await new Promise(res => setTimeout(res, 1800));

    const bidLog = arbitrageManager.getBidLog();
    const [initial, firstTry, secondTry, thirdTry] = await Promise.all(bidLog);

    t.deepEqual(initial, {
        msg: 'Error when fetching market price',
        data: new Error('MockReject')
    });

    t.deepEqual(firstTry, {
        msg: 'Error when fetching market price',
        data: new Error('MockReject')
    });

    t.deepEqual(secondTry, {
        msg: 'Error when fetching market price',
        data: new Error('MockReject')
    });

    t.deepEqual(thirdTry, {
        msg: 'Error when fetching market price',
        data: new Error('MockReject')
    });

    t.is(bidLog.length, 4);

    // Check that retry count stays the same within the same clock step
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_850_000n) });
    const bidLogSameClockStep = arbitrageManager.getBidLog();
    t.deepEqual(await bidLogSameClockStep[4], {
        msg: 'Error when fetching market price',
        data: new Error('MockReject')
    });
    t.is(bidLogSameClockStep.length, 5);

    // Now move the clock step and check that it retries again
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_650_000n) });
    await new Promise(res => setTimeout(res, 1800)); // Wait until all retries complete
    const bidLogNewClockStep = arbitrageManager.getBidLog();

    (await Promise.all(bidLogNewClockStep)).slice(-4).forEach(tryData => {
        t.deepEqual(tryData, {
            msg: 'Error when fetching market price',
            data: new Error('MockReject')
        });
    });

    t.is(bidLogNewClockStep.length, 9);
});