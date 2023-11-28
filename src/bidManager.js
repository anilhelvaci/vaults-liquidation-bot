import { makeTransactionSender } from './transactionSender.js';

const makeBidManager = (offerSender = makeTransactionSender()) => {
    let count = 0;

    const placeBid = ({ bidAmount, maxColAmount, price, minColAmount }) => {
        const offerSpec = {
            id: `place-bid-${count}`,
            invitationSpec: {
                source: 'agoricContract',
                instancePath: ['auctioneer'],
                callPipe: [['makeBidInvitation', [maxColAmount.brand]]],
            },
            proposal: {
                give: {
                    Bid: bidAmount,
                },
                ...(minColAmount
                    ? {
                          want: {
                              Collateral: minColAmount,
                          },
                      }
                    : {}),
            },
            offerArgs: {
                exitOnBuy: true,
                maxBuy: maxColAmount,
                offerPrice: price,
            },
        };

        const sendP = offerSender.send(offerSpec);
        count++;
        return harden({ offerId: offerSpec.id, states: [sendP] });
    };

    const cancelBid = async (offerId) => {
        await offerSender.cancel(offerId);
    };

    return harden({
        placeBid,
        cancelBid,
    });
};
harden(makeBidManager);

export { makeBidManager };
