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

test.beforeEach(t => {
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

test.serial('initial', t => {
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
test.serial('sequential', async t => {
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
test.serial('retry-on-price-fetch-error', async t => {
    const { arbitrageManager, notify, makePrice, externalManager } = t.context;

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

/**
 * - Successfully place bid on the auction
 * - Bid result with an offer error on zoe
 * - Should register a retry
 */
test.serial('retry-on-offer-error', async t => {
    const { arbitrageManager, notify, makePrice, config, moola } = t.context;

    // initialize state
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_065_000n) });
    notify(StateManagerKeys.SCHEDULE_STATE, {
        nextDescendingStepTime: {
            absValue: BigInt(Date.now()) / MILI_SEC + 60n * MILI_SEC,
            timerBrand: {},
        },
    });

    const bidLogOne = arbitrageManager.getBidLog();
    const [pendingBid] = await Promise.all(bidLogOne);

    t.deepEqual(pendingBid, {
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
        },
    });

    // Trigger maybePlaceBid again for the same clock step
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_065_000n) });
    const bidLogTwo = arbitrageManager.getBidLog();
    const [_, existingBid] = await Promise.all(bidLogTwo);
    t.deepEqual(existingBid, {
        msg: 'Already existing bid. Either pending or success',
        data: {
            currentBid: {
                offerId: 'place-bid-0',
                state: 'pending',
            },
        },
    });

    const offerUpdateError = harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            numWantsSatisfied: 0,
            error: 'Error withdrawal ... purse only contained...',
        },
    });
    notify(StateManagerKeys.WALLET_UPDATE, offerUpdateError);
    await new Promise(res => setTimeout(res, 600));

    const bidLogThree = arbitrageManager.getBidLog();
    const [retryBid] = (await Promise.all(bidLogThree)).slice(-1);

    t.deepEqual(retryBid, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-1',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(7_065_000n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(7_065_000n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });
    t.is(bidLogThree.length, 3);

    // Trigger maybePlaceBid again for the next clock step
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(6_672_500n) });
    const bidLogFour = arbitrageManager.getBidLog();
    const [nextPending] = (await Promise.all(bidLogFour)).slice(-1);
    t.deepEqual(nextPending, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-2',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(6_672_500n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(6_672_500n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });
    t.is(bidLogFour.length, 4);

    // Trigger retry
    notify(
        StateManagerKeys.WALLET_UPDATE,
        harden({
            ...offerUpdateError,
            status: { ...offerUpdateError.status, id: 'place-bid-2' },
        }),
    );
    await new Promise(res => setTimeout(res, 600));

    const bidLogFive = arbitrageManager.getBidLog();
    const [nextRetryOne] = (await Promise.all(bidLogFive)).slice(-1);
    t.deepEqual(nextRetryOne, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-3',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(6_672_500n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(6_672_500n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });
    t.is(bidLogFive.length, 5);

    // Trigger second retry
    notify(
        StateManagerKeys.WALLET_UPDATE,
        harden({
            ...offerUpdateError,
            status: { ...offerUpdateError.status, id: 'place-bid-3' },
        }),
    );
    await new Promise(res => setTimeout(res, 600));

    const bidLogSix = arbitrageManager.getBidLog();
    const [nextRetryTwo] = (await Promise.all(bidLogSix)).slice(-1);
    t.deepEqual(nextRetryTwo, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-4',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(6_672_500n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(6_672_500n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });
    t.is(bidLogSix.length, 6);

    // Trigger third retry
    notify(
        StateManagerKeys.WALLET_UPDATE,
        harden({
            ...offerUpdateError,
            status: { ...offerUpdateError.status, id: 'place-bid-4' },
        }),
    );
    await new Promise(res => setTimeout(res, 600));

    const bidLogSeven = arbitrageManager.getBidLog();
    const [nextRetryThree] = (await Promise.all(bidLogSeven)).slice(-1);
    t.deepEqual(nextRetryThree, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-5',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(6_672_500n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(6_672_500n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });
    t.is(bidLogSeven.length, 7);

    // Trigger third retry
    notify(
        StateManagerKeys.WALLET_UPDATE,
        harden({
            ...offerUpdateError,
            status: { ...offerUpdateError.status, id: 'place-bid-5' },
        }),
    );
    await new Promise(res => setTimeout(res, 600));
    const bidLogEight = arbitrageManager.getBidLog();
    const [nextShouldNotRetry] = (await Promise.all(bidLogEight)).slice(-1);
    t.deepEqual(nextShouldNotRetry, nextRetryThree);
    t.is(bidLogEight.length, 7);

    // Move to the next clock to see if the retry got reset
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(6_280_000n) });
    const bidLogNine = arbitrageManager.getBidLog();
    const [stepThreePending] = (await Promise.all(bidLogNine)).slice(-1);
    t.deepEqual(stepThreePending, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-6',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(6_280_000n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(6_280_000n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });
    t.is(bidLogNine.length, 8);
});

/**
 * Mix retries
 * - Fetch fails, retry registered
 * - Fetch succeeds on retry, bid placed
 * - Placed bid fails, retry registered again
 * - Fetch fails again, last retry registered
 * - Last retry places the bid
 * - Placed bid fails no retries are registered
 * - Clock moved to the next step and bid is placed
 */
test.serial('retry-mix', async t => {
    const { arbitrageManager, notify, makePrice, externalManager, config, moola } = t.context;

    externalManager.setShouldSuccess(false); // Make sure external manager throws

    // initialize state
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_065_000n) });
    notify(StateManagerKeys.SCHEDULE_STATE, {
        nextDescendingStepTime: {
            absValue: BigInt(Date.now()) / MILI_SEC + 60n * MILI_SEC,
            timerBrand: {},
        },
    });
    externalManager.setShouldSuccess(true);
    await new Promise(res => setTimeout(res, 600));

    const bidLogOne = arbitrageManager.getBidLog();
    const [initial, firstRetry] = await Promise.all(bidLogOne);

    t.deepEqual(initial, {
        msg: 'Error when fetching market price',
        data: new Error('MockReject'),
    });

    t.deepEqual(firstRetry, {
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
        },
    });

    // Trigger the second retry by failing the first's bid
    const offerUpdateError = harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            numWantsSatisfied: 0,
            error: 'Error withdrawal ... purse only contained...',
        },
    });
    notify(StateManagerKeys.WALLET_UPDATE, offerUpdateError);

    externalManager.setShouldSuccess(false); // Second retry should fail
    await new Promise(res => setTimeout(res, 600));

    externalManager.setShouldSuccess(true); // Third retry should place the bid
    await new Promise(res => setTimeout(res, 600));

    const bidLogTwo = arbitrageManager.getBidLog();
    const [,, secondRetry, thirdRetry] = await Promise.all(bidLogTwo);

    t.deepEqual(secondRetry, {
        msg: 'Error when fetching market price',
        data: new Error('MockReject'),
    });

    t.deepEqual(thirdRetry, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-1',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(7_065_000n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(7_065_000n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });

    // Fail the last retry and check if a fourth one is registered
    notify(
        StateManagerKeys.WALLET_UPDATE,
        harden({
            ...offerUpdateError,
            status: { ...offerUpdateError.status, id: 'place-bid-1' },
        }),
    );
    await new Promise(res => setTimeout(res, 600));

    const bidLogThree = arbitrageManager.getBidLog();
    const [lastLog] = (await Promise.all(bidLogThree)).slice(-1);

    t.deepEqual(lastLog, thirdRetry);
    t.is(bidLogThree.length, 4);

    // Move to the next clock step and check if retry is enabled
    externalManager.setShouldSuccess(false);
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(6_672_500n) });
    externalManager.setShouldSuccess(true);
    await new Promise(res => setTimeout(res, 600));

    const bidLogFour = arbitrageManager.getBidLog();
    const [nextInitial, nextRetry] = (await Promise.all(bidLogFour)).slice(-2);

    t.deepEqual(nextInitial, {
        msg: 'Error when fetching market price',
        data: new Error('MockReject'),
    });

    t.deepEqual(nextRetry, {
        msg: 'Bid Placed',
        data: {
            offerId: 'place-bid-2',
            bidUtils: {
                bidAmount: moola.make(config.credit),
                maxColAmount: floorDivideBy(moola.make(config.credit), makePrice(6_672_500n)),
                price: makePrice(7_350_000n),
            },
            currentPriceLevel: makePrice(6_672_500n),
            worstDesiredPrice: makePrice(7_350_000n),
            externalPrice: makePrice(7_850_000n),
        },
    });
    t.is(bidLogFour.length, 6);
});

/**
 * - Place bid
 * - Offer succeeds
 * - Check externalLog with the sell info
 */
test.serial('sell-on-success', async t => {
    const { arbitrageManager, notify, makePrice, config, moola } = t.context;

    // initialize state
    notify(StateManagerKeys.BOOK_STATE, { currentPriceLevel: makePrice(7_065_000n) });

    const bidLogOne = arbitrageManager.getBidLog();
    const [initial] = await Promise.all(bidLogOne);

    t.deepEqual(initial, {
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
        },
    });

    // Send successful offer update
    const offerUpdateSuccess = harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            numWantsSatisfied: 1,
            payouts: {
                Collateral: floorDivideBy(moola.make(config.credit), makePrice(7_065_000n))
            }
        },
    });
    notify(StateManagerKeys.WALLET_UPDATE, offerUpdateSuccess);

    const externalLog = arbitrageManager.getExternalLog();
    const [sellCollateral] = await Promise.all(externalLog);

    t.deepEqual(sellCollateral, {
        msg: 'Sold',
        data: {
            txHash: '0x01234',
            sellUtils: {
                amountIn: floorDivideBy(moola.make(config.credit), makePrice(7_065_000n)),
                ...offerUpdateSuccess,
            },
        }
    });

    t.is(externalLog.length, 1);
});
