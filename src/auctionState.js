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

        state[stateKey] = harden({
            ...currentState,
            ...data,
        });
        
        if (stateKey === StateManagerKeys.BOOK_STATE) setBrands(data);
    };

    const setBrands = data => {
        const { currentPriceLevel } = data;
        if (
            currentPriceLevel === null ||
            (state[StateManagerKeys.BID_BRAND] && state[StateManagerKeys.COLLATERAL_BRAND])
        ) return;

        const {
            numerator: { brand: bidBrand },
            denominator: { brand: colBrand },
        } = currentPriceLevel;

        state[StateManagerKeys.BID_BRAND] = bidBrand;
        state[StateManagerKeys.COLLATERAL_BRAND] = colBrand;
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