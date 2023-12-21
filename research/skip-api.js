import pkg from '@skip-router/core';
const { SkipRouter, SKIP_API_URL } = pkg;

import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { stringToPath } from "@cosmjs/crypto";

const MNEMONIC = "cake steak stereo gospel quote fantasy level sort melt organ lady canoe airport cause wonder family cat average kitten glow trigger goddess broken hockey";

const client = new SkipRouter({
    apiURL: SKIP_API_URL
});

const getSigner = async (chainID) => {
    switch (chainID) {
        case "agoric-3":
            return DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: "agoric", hdPaths: [stringToPath("m/44'/564'/0'/0/0")] });
        case "axelar-dojo-1":
            return DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: "axelar", hdPaths: [stringToPath("m/44'/750'/0'/0/0")] });
        case "osmosis-1":
            return DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: "osmosis", hdPaths: [stringToPath("m/44'/118'/0'/0/0")] });
        default:
            throw new Error("Unsupported chainID: " + chainID);
    
    }
}

async function main() {
    const chains = await client.chains();
    const assetsAgoric = await client.assets({
        chainID: "agoric-3"
    });
    const assetsOsmosis = await client.assets({
        chainID: "osmosis-1"
    });

    // console.log((await client.chains()).map((chain) => chain.chainID));

    const res = await client.route({
        sourceAssetChainID: "agoric-3",
        sourceAssetDenom: "ibc/295548A78785A1007F232DE286149A6FF512F180AF5657780FC89C009E2C348F",
        destAssetChainID: "osmosis-1",
        destAssetDenom: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4",
        amountIn: "1000000"
    })

    console.log(res);

    await client.executeRoute({
        route: res,
        userAddresses: {
            'agoric-3': "agoric1n03xctchuqzwt3vwwndjzulph48jxdsgqk8090",
            "axelar-dojo-1": "axelar1wzgqv0kwhzsshd0mwsfajvd2e58cpl35aqqrug",
            "osmosis-1": "osmo1wzgqv0kwhzsshd0mwsfajvd2e58cpl35349mpm"
        },
        getCosmosSigner: getSigner,
        slippageTolerancePercent: "0.1"
    })

    // console.log(res.operations)

    // // console.log(chains.map((chain) => chain.chainID));
    // console.log(assetsAgoric["agoric-3"].filter((asset) => asset.symbol === "USDC"));
    // console.log(assetsOsmosis["osmosis-1"].filter((asset) => asset.symbol === "USDC"));
}

main().catch((err) => {
    console.error(err)
    process.exitCode = 1
});