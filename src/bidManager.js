import { makeTransactionSender } from "./transactionSender.js";
import { AmountMath } from "@agoric/ertp/src/amountMath.js";
import { makeRatioFromAmounts } from "@agoric/zoe/src/contractSupport/ratio.js";

const makeBidManager = (offerSender = makeTransactionSender(), brands) => {
    const { bidBrand, collateralBrand } = brands;
    const makeBid = bidValue => AmountMath.make(bidBrand, bidValue);
    const makeCollateral = collateralValue => AmountMath.make(collateralBrand, collateralValue);

    const placeBid = (bidValue, maxColValue, minColValue, priceVal) => {
        const offerSpec = {
            offerId: `place-bid-${Date.now()}`,
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
                offerPrice: makeRatioFromAmounts(makeBid(priceVal), makeCollateral(maxColValue)),
            }
        };

        offerSender.send(offerSpec);
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