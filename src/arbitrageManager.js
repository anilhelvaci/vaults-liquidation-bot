import { getConfig } from './helpers.js';

const makeArbitrageManager = async (getAuctionState, externalManager) => {
    const arbConfig = getConfig();

    const calculateDesiredPrice = externalPrice => {

    };

    const shouldBid = () => {

    };

    return harden({
        shouldBid,
    });
};
harden(makeArbitrageManager);

export { makeArbitrageManager };
