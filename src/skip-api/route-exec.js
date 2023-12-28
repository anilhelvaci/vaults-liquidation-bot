import pkg from '@skip-router/core';
const { SkipRouter, SKIP_API_URL } = pkg;

import { getSigner, getAddressFromSigner } from "./utils";

/**
 * @param {{
 *  route: pkg.RouteResponse,
 *  mnemonic: string,
 *  mnemonicAccountIndex?: string,
 *  slippageTolerancePercent?: string,
 *  skipApiConfigOverride?: pkg.SkipRouterOptions
 * }} params
 */
const executeRoute = params => {
    try {
        const {
            route,
            mnemonic,
            slippageTolerancePercent,
            skipApiConfigOverride
        } = params;

        const mnemonicAccountIndex = params.mnemonicAccountIndex || 0;

        const skipApiConfig = skipApiConfigOverride || {
            apiURL: SKIP_API_URL
        };
        const client = new SkipRouter(skipApiConfig);

        const routeExecPromise = (async () => {
            try {
                let signers = {};
                let userAddresses = [];
                for (const chainID of route.chainIDs) {
                    const signer = await getSigner(chainID, mnemonic, mnemonicAccountIndex);
                    signers[chainID] = signer;
                    userAddresses[chainID] = await getAddressFromSigner(signer);
                }

                await client.executeRoute({
                    route,
                    userAddresses,
                    getCosmosSigner: (chainID) => signers[chainID],
                    slippageTolerancePercent
                });

                return Promise.resolve({
                    msg: 'Route executed successfully',
                    data: { route }
                });
            }
            catch (error) {
                return Promise.resolve({
                    msg: 'Error when executing route',
                    data: { error }
                });
            }
        })()


        return Promise.resolve({
            msg: 'Route execution request sent',
            data: { routeExecPromise }
        });
    }
    catch (error) {
        return Promise.resolve({
            msg: 'Error when executing route',
            data: error
        })
    }
}
// harden(executeRoute);

export { executeRoute };