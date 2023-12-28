import { assert } from '@agoric/assert';
import { StateManagerKeys } from './constants.js';
import { makeCreditManager } from './helpers.js';
import { makeFakeVirtualStuff } from '@agoric/swingset-liveslots/tools/fakeVirtualSupport.js';
import { makeTracer } from '../../agoric-11-wf/packages/internal/src/index.js';

const {
    cm: { makeScalarBigMapStore },
} = makeFakeVirtualStuff();

const trace = makeTracer('AuctionState', true);

const makeAuctionStateManager = arbConfig => {
    const state = {
        [StateManagerKeys.BID_BRAND]: null,
        [StateManagerKeys.COLLATERAL_BRAND]: null,
        [StateManagerKeys.BOOK_STATE]: null,
        [StateManagerKeys.SCHEDULE_STATE]: null,
        [StateManagerKeys.GOVERNANCE_STATE]: null,
        [StateManagerKeys.CREDIT_MANAGER]: null,
        [StateManagerKeys.WALLET_UPDATE]: makeScalarBigMapStore('Bot_Offers'),
    };

    const updateState = (stateKey, data) => {
        trace('updateState', stateKey, data);
        const { [stateKey]: currentState } = state;
        assert(currentState !== undefined, 'Invalid stateKey');

        if (stateKey === StateManagerKeys.WALLET_UPDATE) return handleWalletUpdate(data);

        state[stateKey] = harden({
            ...currentState,
            ...data,
        });

        tryInit(stateKey, data);
    };

    /**
     * In the first active auction book state update:
     * - set bid and col brands
     * - initialize credit manager
     *
     * The notifications before the above notification simply does nothing
     *
     * The ones coming after shouldn't change col and bid brands even if we override them. And we shall not re-init
     * creditManager during the lifecycle. The state of the credit manager can only be updated by the state manager.
     * We kill the credit manager instance when the checkout policy is met.
     *
     * @param key
     * @param data
     */
    const tryInit = (key, data) => {
        if (key !== StateManagerKeys.BOOK_STATE) return;
        if (!data.currentPriceLevel) return;
        if (checkInitialized()) return;

        const {
            numerator: { brand: bidBrand },
            denominator: { brand: colBrand },
        } = data.currentPriceLevel;

        console.log('[tryInit]', {
            bidBrand,
            colBrand,
        });

        state[StateManagerKeys.BID_BRAND] = bidBrand;
        state[StateManagerKeys.COLLATERAL_BRAND] = colBrand;
        state[StateManagerKeys.CREDIT_MANAGER] = makeCreditManager(bidBrand, arbConfig.credit);
    };

    const handleWalletUpdate = data => {
        trace('handleWalletUpdate - initialized', checkInitialized());
        if (!checkInitialized()) return;

        const { creditManager } = state;
        const { status, updated } = data;
        trace('handleWalletUpdate - data', status);

        if (updated === 'balance') return;

        writeOffer(data);

        if (status.error && !status.payouts) return;

        if (status.payouts) {
            const { Bid: excessBidAmount } = status.payouts;
            if (!excessBidAmount) return;
            trace('handleWalletUpdate', 'incrementCredit by', excessBidAmount);
            creditManager.incrementCredit(excessBidAmount);
        } else {
            const {
                give: { Bid: paidBidAmount },
            } = status.proposal;
            trace('handleWalletUpdate', 'decrementCredit by', paidBidAmount);
            creditManager.decrementCredit(paidBidAmount);
        }
        trace('handleWalletUpdate', 'credit', creditManager.getCredit());
    };

    const checkInitialized = () => {
        return !!(
            state[StateManagerKeys.BID_BRAND] &&
            state[StateManagerKeys.COLLATERAL_BRAND] &&
            state[StateManagerKeys.CREDIT_MANAGER] &&
            state[StateManagerKeys.BOOK_STATE].currentPriceLevel
        );
    };

    const writeOffer = data => {
        const { [StateManagerKeys.WALLET_UPDATE]: offers } = state;

        if (!offers.has(data.status.id)) {
            trace('writeOffer', 'write new offer', data.status.id);
            offers.init(data.status.id, data);
            return;
        }
        trace('writeOffer', 'update offer', data.status.id);
        offers.set(data.status.id, data);
    };

    const getState = () => {
        // Better to return a copy instead of the actual state
        const creditManager = state[StateManagerKeys.CREDIT_MANAGER];
        const copyState = {
            ...state,
            initialized: checkInitialized(),
            [StateManagerKeys.CREDIT_MANAGER]: checkInitialized()
                ? harden({
                      checkEnoughBalance: creditManager.checkEnoughBalance,
                      getCredit: creditManager.getCredit,
                  })
                : {},
            offers: [...state[StateManagerKeys.WALLET_UPDATE].entries()],
        };
        return harden(copyState);
    };

    return harden({
        updateState,
        getState,
    });
};
harden(makeAuctionStateManager);

export { makeAuctionStateManager };
