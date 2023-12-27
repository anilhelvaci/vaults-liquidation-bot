import { makeRatio } from '../../../agoric-11-wf/packages/zoe/src/contractSupport/index.js';
import { StateManagerKeys } from '../../src/constants.js';
import { poolRates } from '../../_agstate/yarn-links/@agoric/vats/src/core/demoIssuers.js';

export const bigIntReplacer = (_, v) => (typeof v === 'bigint' ? v.toString() : v);
harden(bigIntReplacer);

export const makeSmokeTestExternalManager = getState => {
    const fetchExternalPrice = () => {
        const {
            initialized,
            [StateManagerKeys.BID_BRAND]: bidBrand,
            [StateManagerKeys.COLLATERAL_BRAND]: colBrand,
        } = getState();

        console.log({
            initialized,
            bidBrand,
            colBrand,
        });

        if (!initialized)
            return Promise.reject({
                msg: 'State not initialized',
                data: { initialized, bidBrand, colBrand },
            });

        // ATOM price on 31-10-2023
        const mockPrice = makeRatio(7_850_000n, bidBrand, 1_000_000n, colBrand);
        return Promise.resolve(mockPrice);
    };

    const sell = async sellUtils => {
        console.log('Sell called with: ', sellUtils);

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
