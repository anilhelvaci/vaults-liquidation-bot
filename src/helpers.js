import strategyConfig from '../strategy.config.js';
import { assert } from '@agoric/assert';
import { BID_BRAND_NAME, StateManagerKeys } from "./constants.js";

const getConfig = () => {
    const strategyIndex = process.env.STRATEGY || 0;
    const strategy = strategyConfig[strategyIndex];

    return harden({
        delta: process.env.LIQ_DELTA || strategy.delta,
        collateralName: strategy.collateralName,
        bookId: process.env.LIQ_BOOK_ID || strategy.bookId,
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

const setAuctionBrands = (brands, setter) => {
    const { collateralName } = getConfig();

    [...brands].forEach(([name, brand]) => {
        if (name === BID_BRAND_NAME) setter(StateManagerKeys.BID_BRAND, brand);
        if (name === collateralName) setter(StateManagerKeys.COLLATERAL_BRAND, brand);
    });
};
harden(setAuctionBrands);

export { getConfig, getBrandsFromBook, setAuctionBrands };
