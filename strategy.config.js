/**
 * Built-in configurations:
 * - delta is exact, spending is flash
 * - delta is exact, spending is controlled
 * - delta is percentage, spending is flash
 * - delta is percentage, spending is controlled
 */

export default [
    {
        delta: {
            type: 'exact',
            value: 500000n // 0.5 IST
        },
        spend: {
            type: 'flash'
        },
        credit: 100_000_000n, // 100 IST credit
        collateralName: 'ATOM',
        bookId: 0,
        retryInterval: 30 * 1000 // 30 seconds in ms
    },
    {
        delta: {
            type: 'exact',
            value: 500000n // 0.5 IST
        },
        spend: {
            type: 'controlled',
            controlFactor: 10n, // amountIn = credit / controlFactor
        },
        credit: 100_000_000n, // 100 IST credit
        collateralName: 'ATOM',
        bookId: 0,
        retryInterval: 30 * 1000 // 30 seconds in ms
    },
    {
        delta: {
            type: 'percentage',
            value: 5n // 5% off from the external price
        },
        spend: {
            type: 'flash',
        },
        credit: 100_000_000n, // 100 IST credit
        collateralName: 'ATOM',
        bookId: 0,
        retryInterval: 30 * 1000 // 30 seconds in ms
    },
    {
        delta: {
            type: 'percentage',
            value: 5n // 5% off from the external price
        },
        spend: {
            type: 'controlled',
            controlFactor: 10n, // amountIn = credit / controlFactor
        },
        credit: 100_000_000n, // 100 IST credit
        collateralName: 'ATOM',
        bookId: 0,
        retryInterval: 30 * 1000 // 30 seconds in ms
    },
];
