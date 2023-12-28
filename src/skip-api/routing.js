import pkg from '@skip-router/core';
const { SkipRouter, SKIP_API_URL } = pkg;

/**
 * @param {{
 *  sourceAssetChainID: string, 
 *  sourceAssetDenom: string, 
 *  destAssetChainID: string, 
 *  destAssetDenom: string, 
 *  amountIn: bigint, 
 *  skipApiConfigOverride?: pkg.SkipRouterOptions
 * }} params
 * 
 * @returns {Promise<{ msg: string, data: Error | pkg.RouteResponse }>}
 */
const getRoute = async params => {
    try {
        const {
            sourceAssetChainID,
            sourceAssetDenom,
            destAssetChainID,
            destAssetDenom,
            amountIn,
            skipApiConfigOverride
        } = params;

        const skipApiConfig = skipApiConfigOverride || {
            apiURL: SKIP_API_URL
        };

        const client = new SkipRouter(skipApiConfig);

        const route = await client.route({
            sourceAssetChainID,
            sourceAssetDenom,
            destAssetChainID,
            destAssetDenom,
            amountIn: amountIn.toString()
        });

        return Promise.resolve({
            msg: 'Route fetched successfully',
            data: route
        });
    }
    catch (error) {
        return Promise.resolve({
            msg: 'Error when fetching route',
            data: error
        })
    }
}
// harden(getRoute);

export { getRoute };