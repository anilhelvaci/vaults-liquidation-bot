import { StateUpdates } from "./constants.js";

const makeArbitrager = (bidManager, auctionWatcher) => {
    function* startArbitraging() {
        while (true) {
            const { type, data } = yield;
            switch (type) {
                case StateUpdates.BOOK:
                    console.log('BookUpdate', { data });
                    break;
                case StateUpdates.SCHEDULE:
                    console.log('ScheduleUpdate', { data });
                    break;
                case StateUpdates.GOVERNANCE:
                    console.log('GovernanceUpdate', { data });
                    break;
                case StateUpdates.TERMINATE:
                    console.log('We are done', { data });
                    return;
            }
        }
    }

    const startArbing = startArbitraging();
    startArbing.next()

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