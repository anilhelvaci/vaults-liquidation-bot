import '../../installSesLockdown.js';
import { writeFileSync } from 'fs';
import { makeAuctionWatcher } from '../../src/auctionWatcher.js';
import { makeAuctionStateManager } from '../../src/auctionState.js';
import { makeBidManager } from '../../src/bidManager.js';
import { makeArbitrageManager } from '../../src/arbitrageManager.js';
import { makeTransactionSender } from '../../src/transactionSender.js';
import { bigIntReplacer, makeSmokeTestExternalManager, makeWalletWatchTrigger } from './tools.js';
import strategyConfig from './test.strategy.config.js';

const main = async () => {
    const timestamp = Date.now();
    const networkConfig = 'https://wallet.agoric.app/wallet/network-config';
    const configIndex = process.env.CONFIG || 0;
    const config = strategyConfig.strategies[configIndex];
    const { watch, marshaller, watchSmartWallet } = makeAuctionWatcher({
        networkConfig,
        bookId: config.bookId,
        auctioneerPath: 'fakeAuctioneer',
        address: strategyConfig.account.address,
    });
    const stateManager = makeAuctionStateManager(config);
    const offerSender = await makeTransactionSender({
        networkConfig,
        marshaller,
        from: strategyConfig.account.name,
    });
    const bidManager = makeBidManager(offerSender, 'fakeAuctioneer');
    const externalManager = makeSmokeTestExternalManager(stateManager.getState);
    const { triggerWatch } = makeWalletWatchTrigger(watchSmartWallet);

    const finish = async getBidLog => {
        const bidLogP = getBidLog();
        const logs = await Promise.allSettled(bidLogP);
        console.log(JSON.stringify(logs, bigIntReplacer, 2));
    };

    const arbitrageManager = makeArbitrageManager({
        getAuctionState: stateManager.getState,
        externalManager,
        bidManager,
        arbConfig: harden(config),
        finish,
        onBid: triggerWatch,
    });

    const notify = (type, data) => {
        stateManager.updateState(type, data);
        arbitrageManager.onStateUpdate(type);
    };
    watch(notify);

    process.on('unhandledRejection', async (reason, promise) => {
        promise.catch(err => {
            const errorLog = `Unhandled Rejection at: ${err.stack}, reason: ${reason}`;
            console.error(JSON.stringify(errorLog, bigIntReplacer, 2));
            writeFileSync(`error-${timestamp}.log`, errorLog, { flag: 'as+' });
        });
    });

    process.on('SIGINT', async () => {
        const bidLogP = arbitrageManager.getBidLog();
        const logs = (await Promise.allSettled(bidLogP)).map(log => log.value);
        console.log({
            logs,
        });
        writeFileSync(`bids-${timestamp}.log.json`, JSON.stringify(logs, bigIntReplacer, 2));
        process.exit(0);
    });
};

main()
    .then(() => console.log('Done'))
    .catch(err => {
        console.log({ err });
        process.exit(1);
    });
