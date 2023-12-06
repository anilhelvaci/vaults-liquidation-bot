import strategyConfig from '../strategy.config.js';
import { assert, details as X } from '@agoric/assert';
import { BID_BRAND_NAME, StateManagerKeys } from './constants.js';
import { assertIsRatio, makeRatioFromAmounts, floorDivideBy, quantize } from '@agoric/zoe/src/contractSupport/ratio.js';
import { AmountMath } from '@agoric/ertp/src/amountMath.js';
import { mustMatch } from '@endo/patterns';
import { SPEND_TYPE_SHAPE } from './typeGuards.js';
import { natSafeMath } from '@agoric/zoe/src/contractSupport/safeMath.js';

const getConfig = (index = 0) => {
    const strategyIndex = process.env.STRATEGY || index;
    return harden(strategyConfig[strategyIndex]);
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

/**
 * @param {{type: string, value: bigint}} delta
 * @param state
 * @param externalPrice
 *
 * Calculates => dp = externalPrice - delta.value
 */
const calculateDPExactDelta = (delta, state, externalPrice) => {
    const { bidBrand } = state;
    assertIsRatio(externalPrice);

    const verifiedNumerator = AmountMath.coerce(bidBrand, externalPrice.numerator);
    const deltaAmount = AmountMath.make(bidBrand, delta.value);
    const newNumerator = AmountMath.subtract(verifiedNumerator, deltaAmount);

    return makeRatioFromAmounts(newNumerator, externalPrice.denominator);
};
harden(calculateDPExactDelta);

/**
 *
 * @param delta
 * @param state
 * @param externalPrice
 */
const calculateDPPercentageDelta = (delta, state, externalPrice) => {
    const { bidBrand } = state;
    assertIsRatio(externalPrice);

    const verifiedNumerator = AmountMath.coerce(bidBrand, externalPrice.numerator);
    const deltaAmount = AmountMath.make(bidBrand,
        natSafeMath.multiply(
            natSafeMath.floorDivide(verifiedNumerator.value, 100n), delta.value
        )
    );
    const newNumerator = AmountMath.subtract(verifiedNumerator, deltaAmount);

    return makeRatioFromAmounts(newNumerator, externalPrice.denominator);
};
harden(calculateDPPercentageDelta);

/**
 *
 * @param stateSnapShot
 * @param worstDesiredPrice
 * @param config
 */
const calculateBidUtils = (stateSnapShot, worstDesiredPrice, config) => {
    mustMatch(config.spend, SPEND_TYPE_SHAPE);

    let bidAmount = AmountMath.makeEmpty(stateSnapShot.bidBrand);

    if (config.spend.type === 'flash') {
        bidAmount = AmountMath.make(stateSnapShot.bidBrand, config.credit);
    } else if (config.spend.type === 'controlled') {
        const valueIn = natSafeMath.floorDivide(config.credit, config.spend.controlFactor);
        bidAmount = AmountMath.make(stateSnapShot.bidBrand, valueIn);
    }

    assert(!AmountMath.isEmpty(bidAmount), X`Empty bidAmount is not allowed: ${bidAmount}`);

    const maxColAmount = floorDivideBy(bidAmount, stateSnapShot.bookState.currentPriceLevel);

    return harden({
        bidAmount,
        maxColAmount,
        price: worstDesiredPrice
    });
};
harden(calculateBidUtils);

/**
 * @param stateSnapShot
 * @param offerData
 * @param config
 */
const calculateSellUtils = (stateSnapShot, offerData, config) => {
    const collateralBrand = stateSnapShot[StateManagerKeys.COLLATERAL_BRAND];
    const {
        status: {
            payouts: { Collateral: boughtAmount },
        },
    } = offerData;
    const boughtValue = AmountMath.getValue(collateralBrand, boughtAmount);

    if (boughtValue >= config.maxSellValue) {
        return harden({ amountIn: AmountMath.make(collateralBrand, config.maxSellValue), ...offerData });
    }

    return harden({ amountIn: boughtAmount, ...offerData });
};
harden(calculateSellUtils);

const setBookState = (notify, data) => {
    const { currentPriceLevel } = data;
    const quantizedPrice = currentPriceLevel ? quantize(currentPriceLevel, 1_000_000n) : currentPriceLevel;
    const update = harden({
        ...data,
        currentPriceLevel: quantizedPrice
    });
    notify(StateManagerKeys.BOOK_STATE, update);
};
harden(setBookState);

/**
 *
 * @param {Brand} brand
 * @param {BigInt} creditValue
 */
const makeCreditManager = (brand, creditValue) => {
    let credit = AmountMath.make(brand, creditValue);

    /**
     * @param {Amount} incrementBy
     */
    const incrementCredit = incrementBy => {
        credit = AmountMath.add(credit, incrementBy);
    };

    /**
     * @param {Amount} decrementBy
     */
    const decrementCredit = decrementBy => {
        credit = AmountMath.subtract(credit, decrementBy);
    };

    /**
     * @param {Amount} bidAmount
     */
    const checkEnoughBalance = bidAmount => {
        return AmountMath.isGTE(credit, bidAmount);
    };

    return harden({
        incrementCredit,
        decrementCredit,
        checkEnoughBalance,
        getCredit: () => harden({ ...credit }),
    });
};
harden(makeCreditManager);

export {
    getConfig,
    getBrandsFromBook,
    setAuctionBrands,
    calculateDPPercentageDelta,
    calculateDPExactDelta,
    calculateBidUtils,
    setBookState,
    makeCreditManager,
    calculateSellUtils,
};
