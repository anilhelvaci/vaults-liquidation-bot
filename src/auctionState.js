import { assert } from '@agoric/assert';

const makeAuctionStateManager = () => {
    const state = harden({
        bookState: null,
        scheduleState: null,
        governanceState: null,
    });

    const updateState = (stateKey, data) => {
        const { [stateKey]: currentState } = state;
        assert(currentState !== undefined, 'Invalid stateKey');

        state[stateKey] = harden({
            ...currentState,
            ...data,
        });
    };

    const getState = () => {
        // Better to return a copy instead of the actual state
        const copyState = state;
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