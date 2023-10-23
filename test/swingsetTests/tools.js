import { E } from '@endo/far';
import { eventLoopIteration } from "@agoric/notifier/tools/testSupports.js";
import { makeRatioFromAmounts } from "@agoric/zoe/src/contractSupport/ratio.js";

const makeSmartWalletOfferSender = (offersFacet, eventLoopCallback = eventLoopIteration) => {
    const send = async (offerSpec) => {
        await E(offersFacet).executeOffer(offerSpec);
        await eventLoopCallback();
    };

    return harden({
        send,
    });
};
harden(makeSmartWalletOfferSender);

const getSmartWalletUtils = async smartWallet => {
    const [
        depositFacet,
        offersFacet,
        currentSub,
        updateSub
    ] = await Promise.all([
        E(smartWallet).getDepositFacet(),
        E(smartWallet).getOffersFacet(),
        E(smartWallet).getCurrentSubscriber(),
        E(smartWallet).getUpdatesSubscriber()
    ]);

    return harden({
        depositFacet,
        offersFacet,
        currentSub,
        updateSub,
    });
};

const makeTestSuite = context => {
    const {
        drivers: {
            auctionDriver, walletFactoryDriver
        },
        bid,
        collateral,
    } = context;

    const provideWalletAndUtils = async address => {
        const smartWallet = await walletFactoryDriver.simpleProvideWallet(address);
        const utils = await getSmartWalletUtils(smartWallet);

        return harden({ smartWallet, utils });
    };

    const setupCollateralAuction = (collateralValue = 1000n) => {
        return auctionDriver.setupCollateralAuction(collateral, collateral.make(collateralValue));
    };

    const fundBid = (depositFacet, value) => {
        const bidPayment = bid.mint.mintPayment(bid.make(value));
        return E(depositFacet).receive(bidPayment);
    };

    const advanceTo = absValue => {
        return auctionDriver.advanceTo(absValue);
    };

    /**
     * const price = newPrice / 10Col
     */
    const updateCollateralPrice = newPrice => {
        return auctionDriver.updatePriceAuthority(
            makeRatioFromAmounts(bid.make(newPrice), collateral.make(10n)),
        );
    }

    return harden({
        provideWalletAndUtils,
        setupCollateralAuction,
        getCollateralBrand: () => collateral.brand,
        getBidBrand: () => bid.brand,
        fundBid,
        advanceTo,
        getAuctionSchedules: () => auctionDriver.getSchedule(),
        getTimerService: () => auctionDriver.getTimerService(),
        updateCollateralPrice,
        makeBid: value => bid.make(value),
        makeCollateral: value => collateral.make(value),
    })
};
harden(makeTestSuite);

export {
    makeSmartWalletOfferSender,
    getSmartWalletUtils,
    makeTestSuite,
};