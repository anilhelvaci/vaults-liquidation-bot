import { makeLeader, makeCastingSpec, makeFollower, iterateLatest } from '@agoric/casting';
import { makeImportContext } from '@agoric/smart-wallet/src/marshal-contexts.js';
import { StateManagerKeys } from './constants.js';

const makeAuctionWatcher = ({ networkConfig, bookId, auctioneerPath = 'auctioneer', address }) => {
    const leader = makeLeader(networkConfig);
    const { fromBoard: marshaller } = makeImportContext();
    const options = harden({
        unserializer: marshaller,
    });

    const bookCastingSpec = makeCastingSpec(`:published.${auctioneerPath}.book${bookId}`);
    const bookFollower = makeFollower(bookCastingSpec, leader, options);

    const governanceCastingSpec = makeCastingSpec(`:published.${auctioneerPath}.governance`);
    const governanceFollower = makeFollower(governanceCastingSpec, leader);

    const scheduleCastingSpec = makeCastingSpec(`:published.${auctioneerPath}.schedule`);
    const scheduleFollower = makeFollower(scheduleCastingSpec, leader, options);

    const smartWalletCastingSpec = makeCastingSpec(`:published.wallet.${address}`);
    const smartWalletFollower = makeFollower(smartWalletCastingSpec, leader, options);

    let notify;

    const watchSchedule = async () => {
        for await (const { value: schedule } of iterateLatest(scheduleFollower)) {
            notify(StateManagerKeys.SCHEDULE_STATE, schedule);
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

    const watchSmartWallet = async () => {
        for await (const { value: walletUpdate } of iterateLatest(smartWalletFollower)) {
            notify(StateManagerKeys.WALLET_UPDATE, walletUpdate);
        }
    };

    const watch = notifier => {
        notify = notifier;
        watchSchedule();
        watchBook();
        watchGovernance();
        watchSmartWallet();
    };

    return harden({
        watch,
        marshaller,
    });
};
harden(makeAuctionWatcher);

export { makeAuctionWatcher };
