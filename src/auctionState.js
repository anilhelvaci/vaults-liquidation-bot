import { assert } from '@agoric/assert';
import { StateManagerKeys } from './constants.js';
import { makeCreditManager } from './helpers.js';
import { makeFakeVirtualStuff } from '@agoric/swingset-liveslots/tools/fakeVirtualSupport.js';

const {
    cm: { makeScalarBigMapStore },
} = makeFakeVirtualStuff();

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
        if (!checkInitialized()) return;

        const { creditManager } = state;
        const { status, updated } = data;

        if (updated === 'balance') return;

        writeOffer(data);

        if (status.error && !status.payouts) return;

        if (status.payouts) {
            const { Bid: excessBidAmount } = status.payouts;
            if (!excessBidAmount) return;
            creditManager.incrementCredit(excessBidAmount);
        } else if (!status.payouts && status.numWantsSatisfied && status.numWantsSatisfied === 1) {
            const {
                give: { Bid: paidBidAmount },
            } = status.proposal;
            creditManager.decrementCredit(paidBidAmount);
        }
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
            offers.init(data.status.id, data);
            return;
        }

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
