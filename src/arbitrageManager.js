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
import { ratioGTE, assertIsRatio } from '@agoric/zoe/src/contractSupport/ratio.js';
import { assert, details as X } from '@agoric/assert';

const makeArbitrageManager = (getAuctionState, externalManager, bidManager) => {
    const arbConfig = getConfig();
    const bidLog = [];
    
    let creditManager;

    const onStateUpdate = (type, data = null) => {
        switch (type) {
            case StateManagerKeys.BOOK_STATE:
                const bidPromise = maybePlaceBid();
                bidLog.push(bidPromise);
                break;
            case StateManagerKeys.WALLET_UPDATE:
                handleWalletUpdate(data);
                break;
            default:
                console.log('Not book update');
                break;
        }
    };

    const checkAndInitState = () => {
        const {
            bidBrand,
            colBrand,
            bookState: { currentPriceLevel },
        } = getAuctionState();

        if (!bidBrand || !colBrand || !currentPriceLevel) return false;
        assertIsRatio(currentPriceLevel);

        if (!creditManager) {
            creditManager = makeCreditManager(bidBrand, arbConfig.credit);
        }

        return true;
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
        if (!checkAndInitState()) return harden({ msg: 'State not initialized', data: { ...getAuctionState() } });

        const stateSnapshot = getAuctionState();

        const externalPrice = await externalManager.fetchExternalPrice();
        console.log('STATE', { currentPriceLevel: stateSnapshot.bookState.currentPriceLevel });
        const worstDesiredPrice = calculateDesiredPrice(stateSnapshot, externalPrice);

        if (ratioGTE(worstDesiredPrice, stateSnapshot.bookState.currentPriceLevel)) {
            const bidUtils = calculateBidUtils(stateSnapshot, worstDesiredPrice, harden(arbConfig));
            if (!creditManager.checkEnoughBalance(bidUtils.bidAmount))
                return harden({
                    msg: 'Insufficient credit',
                    data: { bidUtils, credit: creditManager.getCredit() },
                });
            
            bidManager.placeBid(bidUtils);
            creditManager.decrementCredit(bidUtils.bidAmount);
            return harden({
                msg: 'Bid Placed',
                data: {
                    bidUtils,
                    worstDesiredPrice,
                    externalPrice,
                    currentPriceLevel: stateSnapshot.bookState.currentPriceLevel,
                },
            });
        }
        return harden({ msg: 'No Bid', data: { ...stateSnapshot, worstDesiredPrice, externalPrice } });
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
        getBidLog: () => [...bidLog],
    });
};
harden(makeArbitrageManager);

export { makeArbitrageManager };
