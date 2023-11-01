import { StateUpdates } from "./constants.js";

const makeArbitrager = (bidManager, auctionWatcher) => {

    const notify = (type, data) => {
        startArbing.next({ type, data });
    };

    const terminate = () => {
        startArbing.next({ type: StateUpdates.TERMINATE, data: { message: 'Thanks for the cooperation' } });
    }

    auctionWatcher.watch(notify);

    return harden(terminate);
};
harden(makeArbitrager);

export {
    makeArbitrager
};