import strategyConfig from '../strategy.config.js';
import { assert } from '@agoric/assert';

const getConfig = () => {
    const strategyIndex = process.env.STRATEGY || 0;
    const strategy = strategyConfig[0];

    return harden({
        delta: process.env.LIQ_DELTA || strategy.delta,
    });
};
harden(getConfig);

const getBrandsFromBook = bookState => {
    const { currentPriceLevel } = bookState;
    assert(currentPriceLevel, 'Auction Not Active');

    return harden({
        bidBrand: currentPriceLevel.numerator.brand,
        collateralBrand: currentPriceLevel.denominator.brand,
    });
};

export { getConfig, getBrandsFromBook };
