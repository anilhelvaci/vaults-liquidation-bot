import { makeTracer } from '@agoric/internal';

const trace = makeTracer('PriceFeedKit');

export const getPriceFeedKit = async powers => {
    trace('getPriceFeedKit...');

    const {
        consume: { priceFeedKit: priceFeedKitP },
    } = powers;

    const [priceFeedKit] = await Promise.resolve(priceFeedKitP);
    console.log(priceFeedKit);

    trace('Completed...');
};

export const getManifestForGetPriceFeedKit = async () =>
    harden({
        manifest: {
            [getPriceFeedKit.name]: {
                consume: {
                    priceFeedKit: true,
                },
            },
        },
    });
