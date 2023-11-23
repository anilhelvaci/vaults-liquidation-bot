import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { calculateBidUtils, calculateDPExactDelta, getConfig } from '../../src/helpers.js';
import { makeIssuerKit } from '@agoric/ertp';
import { makeRatio } from '@agoric/zoe/src/contractSupport/ratio.js';
import { AmountMath } from '@agoric/ertp';

test.before(t => {
    const bidKit = makeIssuerKit('Bid');
    const collateralKit = makeIssuerKit('Collateral');

    t.context = harden({
        bidKit,
        collateralKit
    });
});

test('initial', t => {
   t.pass('Initial test');
});

test('desired-price-calculations-exact', t => {
    const { bidKit, collateralKit } = t.context;
    const arbConfig = getConfig();

    const externalPrice = makeRatio(7_850_000n, bidKit.brand, 1_000_000n, collateralKit.brand);
    const calculatedPrice = calculateDPExactDelta(arbConfig.delta, {  bidBrand: bidKit.brand }, externalPrice);
    t.deepEqual(
        calculatedPrice,
        makeRatio(
            7_350_000n,
            bidKit.brand,
            1_000_000n,
            collateralKit.brand,
        )
    );
});

test('bid-utils', t => {
    const { bidKit, collateralKit } = t.context;
    const config = getConfig();
    const worstDesiredPrice = makeRatio(7_350_000n, bidKit.brand, 1_000_000n, collateralKit.brand);
    const currentPrice = makeRatio(7_065_000n, bidKit.brand, 1_000_000n, collateralKit.brand);

    const stateSnapshot = {
        bidBrand: bidKit.brand,
        bookState: {
            currentPriceLevel: currentPrice,
        }
    }

    const utils = calculateBidUtils(stateSnapshot, worstDesiredPrice, harden(config));

    t.deepEqual(utils, {
        bidAmount: AmountMath.make(bidKit.brand, 100_000_000n),
        maxColAmount: AmountMath.make(collateralKit.brand, 14154281n,),
        price: worstDesiredPrice,
    });
});