import { assert } from '@agoric/assert';
import { StateManagerKeys } from "./constants.js";

const makeAuctionStateManager = () => {
    const state = {
        [StateManagerKeys.BID_BRAND]: null,
        [StateManagerKeys.COLLATERAL_BRAND]: null,
        [StateManagerKeys.BOOK_STATE]: null,
        [StateManagerKeys.SCHEDULE_STATE]: null,
        [StateManagerKeys.GOVERNANCE_STATE]: null,
    }

    const updateState = (stateKey, data) => {
        const { [stateKey]: currentState } = state;
        assert(currentState !== undefined, 'Invalid stateKey');

        state[stateKey] =
            stateKey === StateManagerKeys.BID_BRAND || StateManagerKeys.COLLATERAL_BRAND
                ? data
                : harden({
                      ...currentState,
                      ...data,
                  });
    };

    const getState = () => {
        // Better to return a copy instead of the actual state
        const copyState = { ...state };
        return harden(copyState);
    };

    return harden({
        updateState,
        getState,
    });
};
harden(makeAuctionStateManager);

export {
    makeAuctionStateManager
};