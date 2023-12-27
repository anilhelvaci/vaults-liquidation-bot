import '../../installSesLockdown.js';
import { makeAuctionWatcher } from '../../src/auctionWatcher.js';

const main = async () => {
    const networkConfig = 'https://wallet.agoric.app/wallet/network-config';
    const { watch, marshaller } = makeAuctionWatcher({
        networkConfig,
        bookId: 0,
        auctioneerPath: 'fakeAuctioneer',
    });
    watch((type, data) =>
        console.log({
            type,
            ...data,
        }),
    );

    process.on('unhandledRejection', async (reason, promise) => {
        console.log({
            reason,
            promise,
        });
    });

    process.on('uncaughtException', err => {
        console.log('erelr', err);
    });
};

main().then(() => console.log('Done'));
