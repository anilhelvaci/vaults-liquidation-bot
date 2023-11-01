import {
    calculateDPExactDelta,
    calculateDPPercentageDelta,
    getConfig,
    calculateBidUtils,
    makeCreditManager,
} from './helpers.js';
import { StateManagerKeys } from './constants.js';
import { mustMatch } from '@endo/patterns';
import { DELTA_SHAPE } from './typeGuards.js';
import { ratioGTE } from '@agoric/zoe/src/contractSupport/ratio.js';
import { assert, details as X } from '@agoric/assert';

const makeArbitrageManager = (getAuctionState, externalManager, bidManager) => {
    const arbConfig = getConfig();
    let creditManager;

    const onStateUpdate = (type, data = null) => {
        switch (type) {
            case StateManagerKeys.BOOK_STATE:
                maybePlaceBid();
                break;
            case StateManagerKeys.BID_BRAND:
                initCreditManager();
                break;
            case StateManagerKeys.WALLET_UPDATE:
                handleWalletUpdate(data);
                break;
            default:
                console.log('Not book update');
                break;
        }
    };
    
    const initCreditManager = () => {
        if (creditManager) return;
        
        const { bidBrand } = getAuctionState();
        creditManager = makeCreditManager(bidBrand, arbConfig.credit);
    };

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
        assert(stateSnapshot.bookState.currentPriceLevel !== null, X`Auction must be active: ${stateSnapshot}`);
        assert(creditManager, X`CreditManager undefined`);

        const externalPrice = await externalManager.fetchExternalPrice();
        console.log('STATE', { currentPriceLevel: stateSnapshot.bookState.currentPriceLevel });
        const worstDesiredPrice = calculateDesiredPrice(stateSnapshot, externalPrice);

        if (ratioGTE(worstDesiredPrice, stateSnapshot.bookState.currentPriceLevel)) {
            const bidUtils = calculateBidUtils(stateSnapshot, worstDesiredPrice, harden(arbConfig));
            if (!creditManager.checkEnoughBalance(bidUtils.bidAmount)) return;
            console.log('YES_BID', { ...bidUtils });
            bidManager.placeBid(bidUtils);
            creditManager.decrementCredit(bidUtils.bidAmount);
            return;
        }
        console.log('NO_BID');
    };

    const handleWalletUpdate = data => {
        assert(data, X`No data for wallet update: ${data}`);

        if (data.hasOwnProperty('payouts') && data.payouts.hasOwnProperty('Bid') && creditManager) {
            const {
                payouts: { Bid: refundAmount },
            } = data;
            creditManager.incrementCredit(refundAmount);
        }
    };

    return harden({
        onStateUpdate,
    });
};
harden(makeArbitrageManager);

export { makeArbitrageManager };
