import { makeTracer } from '@agoric/internal/src/index.js';

const trace = makeTracer('TransactionSender', true);

const makeBidManager = (offerSender, instance = 'auctioneer') => {
    let count = 0;
    trace('makeBidManager', instance);

    const placeBid = ({ bidAmount, maxColAmount, price, minColAmount }) => {
        trace('placeBid', {
            bidAmount,
            maxColAmount,
            price,
            minColAmount,
        });
        const offerSpec = {
            id: `place-bid-${count}-${Date.now()}`,
            invitationSpec: {
                source: 'agoricContract',
                instancePath: [instance],
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

    const cancelBid = offerId => {
        trace('cancelBid', {
            offerId,
        });
        return offerSender.cancel(offerId);
    };

    return harden({
        placeBid,
        cancelBid,
    });
};
harden(makeBidManager);

export { makeBidManager };
