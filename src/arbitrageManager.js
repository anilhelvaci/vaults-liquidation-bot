import { calculateDPExactDelta, calculateDPPercentageDelta, getConfig, calculateBidUtils } from './helpers.js';
import { StateManagerKeys } from './constants.js';
import { mustMatch } from '@endo/patterns';
import { DELTA_SHAPE } from './typeGuards.js';
import { ratioGTE } from '@agoric/zoe/src/contractSupport/ratio.js';
import { assert, details as X } from '@agoric/assert';

const makeArbitrageManager = (getAuctionState, externalManager, bidManager) => {
    const arbConfig = getConfig();

    const calculateDesiredPrice = (state, externalPrice) => {
        mustMatch(arbConfig.delta, DELTA_SHAPE);

        const { type } = arbConfig.delta;

        if (type === 'exact') {
            return calculateDPExactDelta(arbConfig.delta, state, externalPrice);
        } else if (type === 'percentage') {
            return calculateDPPercentageDelta(arbConfig.delta, state, externalPrice);
        }
    };

    const maybePlaceBid = async () => {
        const stateSnapshot = getAuctionState();
        if (stateSnapshot.bookState.currentPriceLevel === null) return; // Auction not ready
        assert(stateSnapshot.currentPriceLevel !== null, X`Auction must be active: ${stateSnapshot}`);

        const externalPrice = await externalManager.fetchExternalPrice();
        console.log('STATE', { currentPriceLevel: stateSnapshot.bookState.currentPriceLevel });
        const worstDesiredPrice = calculateDesiredPrice(stateSnapshot, externalPrice);

        if (ratioGTE(worstDesiredPrice, stateSnapshot.bookState.currentPriceLevel)) {
            const bidUtils = calculateBidUtils(stateSnapshot, worstDesiredPrice, harden(arbConfig));
            console.log('YES_BID', { ...bidUtils })
            bidManager.placeBid(bidUtils);
            return;
        }
        console.log('NO_BID');
    };

    const onStateUpdate = type => {
        switch (type) {
            case StateManagerKeys.BOOK_STATE:
                maybePlaceBid();
                break;
            default:
                console.log('Not book update');
                break;
        }
    };

    return harden({
        onStateUpdate,
    });
};
harden(makeArbitrageManager);

export { makeArbitrageManager };
