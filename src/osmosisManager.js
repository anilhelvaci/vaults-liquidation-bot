import { getOfflineSignerAmino as getOfflineSigner } from 'cosmjs-utils';
import { testnet, chain } from '@chain-registry/osmosis';
import { getSigningOsmosisClient, osmosis } from 'osmojs';

const createSigner = async () => {
    console.log({ signer: 'dummy' });
    const mnemonic = 'key bind kind inhale alarm shoulder occur lend sphere budget call fat';
    const signer = await getOfflineSigner({
        mnemonic,
        chain: testnet,
    });

    console.log(testnet.apis.rpc);

    const accounts = await signer.getAccounts();
    return harden({...signer, accounts});
};

const createClient = async () => {
    const signer = await createSigner();
    const client = await getSigningOsmosisClient({
        rpcEndpoint: testnet.apis.rpc[0].address,
        signer
    });

    return harden({ signer, client });
};

/**
 * Responsible for handling operations related to Osmosis
 */
const makeOsmosisManager = async () => {
    const { client } = await createClient();

    const fetchExternalPrice = async id => {
        const { createRPCQueryClient } = osmosis.ClientFactory;
        const client = await createRPCQueryClient({ rpcEndpoint: chain.apis.rpc[0].address });

        return client.osmosis.poolmanager.v1beta1.spotPrice({
            poolId: id,
            baseAssetDenom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
            quoteAssetDenom: 'uosmo',
        });
    };

    const sell = () => {};

    return harden({
        fetchExternalPrice,
        sell,
        client,
    });
};
harden(makeOsmosisManager);

export { makeOsmosisManager };