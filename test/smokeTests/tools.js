import { makeRatio } from '../../../agoric-11-wf/packages/zoe/src/contractSupport/index.js';
import { StateManagerKeys } from '../../src/constants.js';

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
