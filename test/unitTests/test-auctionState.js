import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { makeAuctionStateManager } from '../../src/auctionState.js';
import { getConfig } from '../../src/helpers.js';
import { StateManagerKeys } from '../../src/constants.js';
import { makeRatioFromAmounts } from '@agoric/zoe/src/contractSupport/ratio.js';
import { withAmountUtils } from '@agoric/smart-wallet/test/supports.js';
import { makeIssuerKit } from '@agoric/ertp';

test.before(t => {
    t.context = {
        moola: withAmountUtils(makeIssuerKit('Moola')),
        simoleans: withAmountUtils(makeIssuerKit('Simoleans')),
    };
});

test('initial', t => {
    t.log(t.context);
    t.pass('Initial test');
});

test('tryInit', t => {
    const { moola, simoleans } = t.context;

    const config = getConfig();
    const { updateState, getState } = makeAuctionStateManager(config);

    const stateZero = getState();
    t.falsy(stateZero.initialized);

    updateState(StateManagerKeys.BOOK_STATE, {
        currentPriceLevel: makeRatioFromAmounts(moola.make(11n), simoleans.make(10n)),
    });

    const stateOne = getState();
    t.truthy(stateOne.initialized);
    t.deepEqual(stateOne[StateManagerKeys.CREDIT_MANAGER].getCredit(), moola.make(config.credit));

    updateState(StateManagerKeys.BOOK_STATE, {
        currentPriceLevel: null,
    });

    const stateTwo = getState();
    t.falsy(stateTwo.initialized);

    updateState(StateManagerKeys.BOOK_STATE, {
        currentPriceLevel: {},
    });

    const stateThree = getState();
    t.truthy(stateThree.initialized);
    t.deepEqual(stateThree[StateManagerKeys.CREDIT_MANAGER].getCredit(), moola.make(config.credit));
});

test('handleWalletUpdate', t => {
    const { moola, simoleans } = t.context;

    const config = getConfig();
    const { updateState, getState } = makeAuctionStateManager(config);

    // Initialize state first
    updateState(StateManagerKeys.BOOK_STATE, {
        currentPriceLevel: makeRatioFromAmounts(moola.make(11n), simoleans.make(10n)),
    });

    const stateZero = getState();
    t.truthy(stateZero.initialized);
    t.is(stateZero.offers.length, 0);

    // InvitationSpec and offerArgs omitted
    const offerUpdateSuccessNoPayout = harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            proposal: { give: { Bid: moola.make(40_000_000n) } },
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
        },
    });

    updateState(StateManagerKeys.WALLET_UPDATE, offerUpdateSuccessNoPayout);
    const stateOne = getState();
    t.is(stateOne.offers.length, 1);
    t.deepEqual(stateOne.creditManager.getCredit(), moola.make(60_000_000n));
    t.deepEqual(stateOne.offers[0], [
        'place-bid-0',
        {
            updated: 'offerStatus',
            status: {
                id: 'place-bid-0',
                proposal: { give: { Bid: moola.make(40_000_000n) } },
                numWantsSatisfied: 1,
                result: 'Your bid has been accepted',
            },
        },
    ]);

    const offerUpdateSuccessWithPayout = harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-0',
            proposal: { give: { Bid: moola.make(40_000_000n) } },
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            payouts: {
                Collateral: simoleans.make(35_000_000n),
                Bid: moola.make(13n),
            },
        },
    });
    updateState(StateManagerKeys.WALLET_UPDATE, offerUpdateSuccessWithPayout);
    const stateTwo = getState();

    t.is(stateTwo.offers.length, 1);
    t.deepEqual(stateTwo.creditManager.getCredit(), moola.make(60_000_013n));
    t.deepEqual(stateTwo.offers[0], [
        'place-bid-0',
        {
            updated: 'offerStatus',
            status: {
                id: 'place-bid-0',
                proposal: { give: { Bid: moola.make(40_000_000n) } },
                payouts: {
                    Collateral: simoleans.make(35_000_000n),
                    Bid: moola.make(13n),
                },
                numWantsSatisfied: 1,
                result: 'Your bid has been accepted',
            },
        },
    ]);

    const offerUpdateErrorNoPayout = harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-1',
            proposal: { give: { Bid: moola.make(40_000_000n) } },
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            error: 'Error withdrawal ... purse only contained...',
        },
    });
    updateState(StateManagerKeys.WALLET_UPDATE, offerUpdateErrorNoPayout);
    const stateThree = getState();

    t.is(stateThree.offers.length, 2);
    t.deepEqual(stateThree.creditManager.getCredit(), moola.make(60_000_013n));
    t.deepEqual(stateThree.offers[1], [
        'place-bid-1',
        {
            updated: 'offerStatus',
            status: {
                id: 'place-bid-1',
                proposal: { give: { Bid: moola.make(40_000_000n) } },
                numWantsSatisfied: 1,
                result: 'Your bid has been accepted',
                error: 'Error withdrawal ... purse only contained...',
            },
        },
    ]);

    const offerUpdateErrorWithPayout = harden({
        updated: 'offerStatus',
        status: {
            id: 'place-bid-2',
            proposal: { give: { Bid: moola.make(40_000_000n) } },
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            error: 'Error withdrawal ... purse only contained...',
            payouts: {
                Bid: moola.make(12_000_000n),
            },
        },
    });
    updateState(StateManagerKeys.WALLET_UPDATE, offerUpdateErrorWithPayout);
    const stateFour = getState();

    t.is(stateFour.offers.length, 3);
    t.deepEqual(stateFour.creditManager.getCredit(), moola.make(72_000_013n));
    t.deepEqual(stateFour.offers[2], [
        'place-bid-2',
        {
            updated: 'offerStatus',
            status: {
                id: 'place-bid-2',
                proposal: { give: { Bid: moola.make(40_000_000n) } },
                numWantsSatisfied: 1,
                result: 'Your bid has been accepted',
                error: 'Error withdrawal ... purse only contained...',
                payouts: {
                    Bid: moola.make(12_000_000n),
                },
            },
        },
    ]);
});
