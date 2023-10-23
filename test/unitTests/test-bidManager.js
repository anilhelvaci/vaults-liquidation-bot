// @ts-ignore

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { makeTestContext, makeTestDriver } from './setup.js';
import {
    makeSmartWalletOfferSender,
    makeTestSuite,
} from '../swingsetTests/tools.js';
import { makeBidManager } from '../../src/bidManager.js';
import { headValue } from '@agoric/smart-wallet/test/supports.js';

const BIDDER_ADDRESS = 'agoricBidder';

test.before(async t => {
    t.context = await makeTestContext();
});

test.beforeEach(async t => {
    t.context.drivers = await makeTestDriver(t);
    console.log('----------------- TEST LOGS -----------------');
});

test('initial', async t => {
    const { drivers } = t.context;
    console.log({ drivers });
    t.pass();
});

test.serial('placed-bid-settles', async t => {
    const suite = makeTestSuite(t.context);
    const { utils } = await suite.provideWalletAndUtils(BIDDER_ADDRESS);
    await suite.setupCollateralAuction();
    await suite.fundBid(utils.depositFacet, 1000n);

    const offerSender = makeSmartWalletOfferSender(utils.offersFacet);
    const bidManager = makeBidManager(
        {
            collateralBrand: suite.getCollateralBrand(),
            bidBrand: suite.getBidBrand(),
        },
        offerSender,
    );
    t.log(bidManager);

    await suite.updateCollateralPrice(11n);
    const schedules = await suite.getAuctionSchedules();

    // Current time 140n, current auction ends at 160n, start delay is 10n
    t.is(schedules.nextAuctionSchedule?.startTime.absValue, 170n);
    await suite.advanceTo(170n); // Start next auction

    // 350 - 300 * (1,1 * 1,05) = 3,5 Bid and 300 Collateral in payouts
    const { offerId, states } = bidManager.placeBid(350n, 300n);
    await Promise.all(states);

    const walletState = await headValue(utils.updateSub);
    t.like(walletState, {
        updated: 'offerStatus',
        status: {
            id: offerId,
            numWantsSatisfied: 1,
            result: 'Your bid has been accepted',
            payouts: {
                Bid: suite.makeBid(3n),
                Collateral: suite.makeCollateral(300n),
            },
        },
    });
});
