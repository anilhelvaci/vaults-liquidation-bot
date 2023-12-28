import test from 'ava';
import { getRoute } from '../../src/skip-api/routing.js';
import { executeRoute } from '../../src/skip-api/route-exec.js';

test.serial('getRoute', async t => {
    const params = {
        sourceAssetChainID: 'agoric-3',
        sourceAssetDenom: 'ibc/295548A78785A1007F232DE286149A6FF512F180AF5657780FC89C009E2C348F',
        destAssetChainID: 'osmosis-1',
        destAssetDenom: 'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4',
        amountIn: 1000000n
    };

    const {msg, data} = await getRoute(params);

    console.log(data.operations[2])

    t.is(msg, 'Route fetched successfully');
    t.true(data.chainIDs.length > 0);
    t.is(data.chainIDs[0], params.sourceAssetChainID);
    t.is(data.chainIDs[data.chainIDs.length - 1], params.destAssetChainID);
    t.is(data.sourceAssetChainID, params.sourceAssetChainID);
    t.is(data.sourceAssetDenom, params.sourceAssetDenom);
    t.is(data.destAssetChainID, params.destAssetChainID);
    t.is(data.destAssetDenom, params.destAssetDenom);
    t.is(data.amountIn, params.amountIn.toString());

    const MNEMONIC = "test test test test test test test test test test test junk";


    const exec = await executeRoute({
        route: data,
        mnemonic: MNEMONIC,
        mnemonicAccountIndex: 0,
        slippageTolerancePercent: "0.1"
    })

    const res = await exec.data.routeExecPromise;

    console.log(res)
});