import { StateManagerKeys } from '../../src/constants.js';
import { makeTracer } from '@agoric/internal/src/index.js';

const trace = makeTracer('Tools', true);

export const bigIntReplacer = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
harden(bigIntReplacer);

export const makeSmokeTestExternalManager = getState => {
    const fetchExternalPrice = () => {
        const {
            initialized,
            [StateManagerKeys.BID_BRAND]: bidBrand,
            [StateManagerKeys.COLLATERAL_BRAND]: colBrand,
            [StateManagerKeys.BOOK_STATE]: { startPrice },
        } = getState();
        trace('fetchExternalPrice', {
            initialized,
            bidBrand,
            colBrand,
            startPrice,
        });

        if (!initialized)
            return Promise.reject({
                msg: 'State not initialized',
                data: { initialized, bidBrand, colBrand },
            });

        return Promise.resolve(startPrice);
    };

    const sell = async sellUtils => {
        trace('sell', sellUtils);

        return harden({
            msg: 'Sold',
            data: {
                txHash: '0x01234',
                sellUtils,
            },
        });
    };

    return harden({
        sell,
        fetchExternalPrice,
    });
};

export const getLatestBlockHeight = async networkConfig => {
    const netConfig = await fetch(networkConfig);
    const {
        chainName,
        rpcAddrs: [rpc],
    } = await netConfig.json();
    console.log('netConfig', { chainName, rpc });

    const block = await fetch(`${rpc}/block`);
    const {
        result: {
            block: {
                header: { height },
            },
        },
    } = await block.json();

    console.log('Height', height);
    return height;
};
harden(getLatestBlockHeight);

export const makeWalletWatchTrigger = watchSmartWallet => {
    let isWatching = false;

    const triggerWatch = async states => {
        if (isWatching === true) return;
        const [pollResult] = await Promise.all(states);
        const { height } = pollResult;
        watchSmartWallet(+height + 1);
        isWatching = true;
    };

    return harden({
        triggerWatch,
    });
};
harden(makeWalletWatchTrigger);
