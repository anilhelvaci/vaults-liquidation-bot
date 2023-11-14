import { calculateDPExactDelta, calculateDPPercentageDelta, calculateBidUtils } from './helpers.js';
import { MILI_SEC, RETRY_LIMIT, StateManagerKeys } from './constants.js';
import { mustMatch } from '@endo/patterns';
import { DELTA_SHAPE } from './typeGuards.js';
import { ratioGTE } from '@agoric/zoe/src/contractSupport/ratio.js';
import { makeScalarBigMapStore } from '@agoric/vat-data';

/**
 *
 * @param getAuctionState
 * @param externalManager
 * @param bidManager
 * @param arbConfig
 * @return {{getBidLog: (function(): *[]), onStateUpdate: onStateUpdate}}
 */
const makeArbitrageManager = (getAuctionState, externalManager, bidManager, arbConfig) => {
    const bidLog = [];
    const bidHistory = makeScalarBigMapStore('Bid History');

    let retryCount = 0;
    
    const onStateUpdate = type => {
        switch (type) {
            case StateManagerKeys.BOOK_STATE:
                const stateSnapshot = getAuctionState();
                handleHistoryOnBookUpdate(stateSnapshot);
                const bidPromise = maybePlaceBid(stateSnapshot);
                bidLog.push(bidPromise);
                break;
            case StateManagerKeys.WALLET_UPDATE:
                handleHistoryOnWalletUpdate();
                break;
            default:
                console.log('Not book update');
                break;
        }
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

    /**
     * - retry limit must not be exceeded
     * - retry must be before the next clock step
     */
    const checkCanRetry = () => {
        if (retryCount >= RETRY_LIMIT) return false;

        const {
            scheduleState: {
                nextDescendingStepTime: { absValue },
            },
        } = getAuctionState();
        const now = Date.now();

        return BigInt(now + arbConfig.retryInterval) < absValue * MILI_SEC;
    };

    const tryExternalPrice = async () => {
        try {
            const externalPrice = await externalManager.fetchExternalPrice();
            return harden({ code: 'success', result: externalPrice });
        } catch (e) {
            if (!checkCanRetry()) return harden({ code: 'error', result: e });

            setTimeout(() => {
                const stateSnapshot = getAuctionState();
                const bidPromise = maybePlaceBid(stateSnapshot);
                bidLog.push(bidPromise);
            }, arbConfig.retryInterval);
            retryCount += 1;
            return harden({ code: 'error', result: e });
        }
    };
    
    const maybePlaceBid = async stateSnapshot => {
        const {
            initialized,
            creditManager,
            bookState: { currentPriceLevel },
        } = stateSnapshot;

        if (!initialized) return harden({ msg: 'State not initialized', data: { ...getAuctionState() } });

        const tryMarketPrice = await tryExternalPrice();
        if (tryMarketPrice.code === 'error')
            return harden({
                msg: 'Error when fetching market price',
                data: tryMarketPrice.result,
            });

        const { result: externalPrice } = tryMarketPrice;
        const worstDesiredPrice = calculateDesiredPrice(stateSnapshot, externalPrice);

        if (ratioGTE(worstDesiredPrice, currentPriceLevel)) {
            const bidUtils = calculateBidUtils(stateSnapshot, worstDesiredPrice, harden(arbConfig));
            if (!creditManager.checkEnoughBalance(bidUtils.bidAmount))
                return harden({
                    msg: 'Insufficient credit',
                    data: { bidUtils, credit: creditManager.getCredit() },
                });

            if (!checkHistory(currentPriceLevel.numerator.value))
                return harden({
                    msg: 'Already existing bid. Either pending or success',
                    data: { currentBid: bidHistory.get(currentPriceLevel.numerator.value) },
                });

            const { offerId } = bidManager.placeBid(bidUtils);
            bidHistory.set(currentPriceLevel.numerator.value, harden({ offerId, state: 'pending'}));
            return harden({
                msg: 'Bid Placed',
                data: {
                    offerId,
                    bidUtils,
                    worstDesiredPrice,
                    externalPrice,
                    currentPriceLevel,
                },
            });
        }
        return harden({ msg: 'No Bid', data: { ...stateSnapshot, worstDesiredPrice, externalPrice } });
    };

    /**
     * - If the currentPriceLevel is null clear the map
     * - If its numerator amount is present in the map do nothing
     * - If it's not present initialize it with false
     * @param stateSnapshot
     */
    const handleHistoryOnBookUpdate = stateSnapshot => {
        const {
            bookState: { currentPriceLevel },
        } = stateSnapshot;
        
        if (currentPriceLevel === null) return bidHistory.clear();
        if (bidHistory.has(currentPriceLevel.numerator.value)) return;

        bidHistory.init(currentPriceLevel.numerator.value, harden({}));
        retryCount = 0;
    };

    const handleHistoryOnWalletUpdate = () => {
        const {
            offers,
            bookState: { currentPriceLevel },
        } = getAuctionState();

        if (currentPriceLevel === null) return;

        const bidData = bidHistory.get(currentPriceLevel.numerator.value);
        const latestMatchingOffer = [...offers].reverse().find(([id, _]) => id === bidData.offerId);

        if(!latestMatchingOffer) return;

        const [_, offerData] = latestMatchingOffer;

        const findBidState = () => {
            const { status: { error, numWantsSatisfied, payouts }} = offerData;

            if (error) return 'error';
            if (numWantsSatisfied && numWantsSatisfied === 1 && payouts) return 'success';
        }

        const updatedData = harden({
            ...bidData,
            state: findBidState(),
        });

        bidHistory.set(currentPriceLevel.numerator.value, updatedData);

        if (updatedData.state === 'error') {
            setTimeout(() => {
                const stateSnapshot = getAuctionState();
                const bidPromise = maybePlaceBid(stateSnapshot);
                bidLog.push(bidPromise);
            }, arbConfig.retryInterval);
            retryCount += 1;
        }
    };

    const checkHistory = key => {
        const bidData = bidHistory.get(key);

        if (!bidData.offerId) return true;
        if (bidData.state === 'error') return true; // Go ahead and bid

        return false;
    };

    return harden({
        onStateUpdate,
        getBidLog: () => harden([...bidLog]),
    });
};
harden(makeArbitrageManager);

export { makeArbitrageManager };
