import { makeLeader, makeCastingSpec, makeFollower, iterateLatest } from '@agoric/casting';
import { makeImportContext } from '@agoric/smart-wallet/src/marshal-contexts.js';
import { setAuctionBrands } from './helpers.js';
import { StateManagerKeys } from './constants.js';

const makeAuctionWatcher = (bookId, networkConfig) => {
    const leader = makeLeader(networkConfig);
    const { fromBoard: marshaller } = makeImportContext();
    const options = harden({
        unserializer: marshaller,
    });

    const bookCastingSpec = makeCastingSpec(`:published.auction.book${bookId}`);
    const bookFollower = makeFollower(bookCastingSpec, leader, options);

    const governanceCastingSpec = makeCastingSpec(':published.auction.governance');
    const governanceFollower = makeFollower(governanceCastingSpec, leader);

    const scheduleCastingSpec = makeCastingSpec(':published.auction.schedule');
    const scheduleFollower = makeFollower(scheduleCastingSpec, leader, options);

    const brandCastingSpec = makeCastingSpec(':published.agoricNames.brand');
    const brandFollower = makeFollower(brandCastingSpec, leader, options);

    let notify;

    const watchSchedule = async () => {
        for await (const { value: schedule } of iterateLatest(scheduleFollower)) {
            notify(StateManagerKeys.SCHEDULE_STATE, schedule);
        }
    };

    const watchBrand = async () => {
        for await (const { value: brands } of iterateLatest(brandFollower)) {
            setAuctionBrands(brands, notify);
        }
    };

    const watchBook = async () => {
        for await (const { value: book } of iterateLatest(bookFollower)) {
            notify(StateManagerKeys.BOOK_STATE, book);
        }
    };

    const watchGovernance = async () => {
        for await (const { value: governanceParams } of iterateLatest(governanceFollower)) {
            notify(StateManagerKeys.GOVERNANCE_STATE, governanceParams);
        }
    };

    const watch = notifier => {
        notify = notifier;
        watchSchedule();
        watchBrand();
        watchBook();
        watchGovernance();
    };

    return harden({
        watch,
        marshaller,
    });
};
harden(makeAuctionWatcher);

export { makeAuctionWatcher };
