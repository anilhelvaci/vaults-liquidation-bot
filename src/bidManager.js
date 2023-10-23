import { makeTransactionSender } from "./transactionSender.js";
import { AmountMath } from "@agoric/ertp/src/amountMath.js";
import { makeRatioFromAmounts } from "@agoric/zoe/src/contractSupport/ratio.js";

const makeBidManager = (brands, offerSender = makeTransactionSender()) => {
    const { bidBrand, collateralBrand } = brands;
    const makeBid = bidValue => AmountMath.make(bidBrand, bidValue);
    const makeCollateral = collateralValue => AmountMath.make(collateralBrand, collateralValue);

    const placeBid = (bidValue, maxColValue, priceVal, minColValue) => {
        const offerSpec = {
            id: `place-bid-${Date.now()}`,
            invitationSpec: {
                source: 'agoricContract',
                instancePath: ['auctioneer'],
                callPipe: [['makeBidInvitation', [collateralBrand]]],
            },
            proposal: {
                give: {
                    Bid: makeBid(bidValue)
                },
                ...(minColValue ? {
                    want: {
                        Collateral: makeCollateral(minColValue),
                    }
                } : {})
            },
            offerArgs: {
                exitOnBuy: true,
                maxBuy: makeCollateral(maxColValue),
                offerPrice: priceVal ? makeRatioFromAmounts(makeBid(priceVal), makeCollateral(maxColValue))
                    : makeRatioFromAmounts(makeBid(bidValue), makeCollateral(maxColValue)),
            }
        };

        const sendP = offerSender.send(offerSpec);
        return harden({ offerId: offerSpec.id, states: [sendP]});
    };

    const cancelBid = () => {

    };

    return harden({
        placeBid,
        cancelBid,
    });
};
harden(makeBidManager);

export {
    makeBidManager
};