import '../../installSesLockdown.js';
import test from 'ava';
import { makeOsmosisManager } from '../../src/osmosisManager.js';
import { osmosis } from 'osmojs';
import { chain } from '@chain-registry/osmosis';

test('initial', t => {
   t.log('Initial test');
   t.pass();
});

test('check-balances', async t => {
   const { client } = await makeOsmosisManager();
   const allBalances = await client.getAllBalances('osmo1qx6zwh5yhe47kncqwxwz6qzeaeyp04fq7c4w09');
   t.log(allBalances);
   t.deepEqual(allBalances, [{
      denom: 'uosmo',
      amount: '20000000',
   }]);
});

test('spot-price', async t => {
   const { fetchExternalPrice } = await makeOsmosisManager();
   const [spotPriceWeighted, spotPriceSupercharged] = await Promise.all([
      fetchExternalPrice(1),
      fetchExternalPrice(1135n)
   ]);

   t.log({ spotPriceWeighted, spotPriceSupercharged });
   t.pass();
});

test('estimate-exact-amount-in', async t => {
   const { createRPCQueryClient } = osmosis.ClientFactory;
   const client = await createRPCQueryClient({ rpcEndpoint: chain.apis.rpc[0].address });

   const amountOut = await client.osmosis.poolmanager.v1beta1.estimateSinglePoolSwapExactAmountIn({
      poolId: 1135n,
      tokenIn: '791000ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
      tokenOutDenom: 'uosmo',
   });

   

   t.log({amountOut});
   t.pass();
});

test('estimate-ist-with-route', async t => {
   const { createRPCQueryClient } = osmosis.ClientFactory;
   const client = await createRPCQueryClient({ rpcEndpoint: chain.apis.rpc[0].address });

   const amountOut = await client.osmosis.poolmanager.v1beta1.estimateSwapExactAmountIn({
      poolId: 1135n,
      tokenIn: '1000000ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
      routes: [
         {
            poolId: 1251,
            tokenOutDenom: 'ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4'
         },
         {
            poolId: 1224,
            tokenOutDenom: 'ibc/92BE0717F4678905E53F4E45B2DED18BC0CB97BF1F8B6A25AFEDF3D5A879B4D5'
         }
      ]
   });

   t.log({amountOut});
   t.pass();
});

test('get-pool', async t => {
   const { createRPCQueryClient } = osmosis.ClientFactory;
   const client = await createRPCQueryClient({ rpcEndpoint: chain.apis.rpc[0].address });

   const [poolInfoOne, poolInfoTwo] = await Promise.all([
       client.osmosis.poolmanager.v1beta1.pool({ poolId: 1 }),
       client.osmosis.poolmanager.v1beta1.pool({ poolId: 1224 }),
   ]);

   console.log({
      ...poolInfoOne.pool.poolParams,
      poolInfoTwo,
   })
   t.pass();
});

