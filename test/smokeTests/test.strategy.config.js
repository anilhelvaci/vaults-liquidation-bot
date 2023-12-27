/**
 * Built-in configurations:
 * - delta is exact, spending is flash
 * - delta is exact, spending is controlled
 * - delta is percentage, spending is flash
 * - delta is percentage, spending is controlled
 */

export default harden({
    account: {
        name: 'user1',
        address: 'agoric1qupryrguze6d4p9rrw6f2rnytqll7pahpk65ru',
    },
    strategies: [
        {
            delta: {
                type: 'exact',
                value: 500000n, // 0.5 IST
            },
            spend: {
                type: 'flash',
            },
            credit: 50_000_000n, // 50 IST credit
            collateralName: 'FakeATOM',
            bookId: 0,
            retryInterval: 30 * 1000, // 30 seconds in ms
            maxSellValue: 1000_000_000n, // Can sell 1k ATOM max to avoid big price impacts on Osmosis
        },
        {
            delta: {
                type: 'exact',
                value: 500000n, // 0.3 IST
            },
            spend: {
                type: 'controlled',
                controlFactor: 4n, // amountIn = credit / controlFactor
            },
            credit: 100_000_000n, // 100 IST credit
            collateralName: 'FakeATOM',
            bookId: 0,
            retryInterval: 30 * 1000, // 30 seconds in ms
            maxSellValue: 1000_000_000n, // Can sell 1k ATOM max to avoid big price impacts on Osmosis
        },
        {
            delta: {
                type: 'percentage',
                value: 6n, // 5% off from the external price
            },
            spend: {
                type: 'flash',
            },
            credit: 100_000_000n, // 100 IST credit
            collateralName: 'FakeATOM',
            bookId: 0,
            retryInterval: 30 * 1000, // 30 seconds in ms
            maxSellValue: 1000_000_000n, // Can sell 1k ATOM max to avoid big price impacts on Osmosis
        },
        {
            delta: {
                type: 'percentage',
                value: 3n, // 3% off from the external price
            },
            spend: {
                type: 'controlled',
                controlFactor: 2n, // amountIn = credit / controlFactor
            },
            credit: 30_000_000n, // 30 IST credit
            collateralName: 'FakeATOM',
            bookId: 0,
            retryInterval: 30 * 1000, // 30 seconds in ms
            maxSellValue: 1000_000_000n, // Can sell 1k ATOM max to avoid big price impacts on Osmosis
        },
    ],
});
