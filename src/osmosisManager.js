/**
 * Responsible for handling operations related to Osmosis
 */
const makeOsmosisManager = () => {
    const fetchExternalPrice = () => {
        return Promise.resolve(7n);
    };

    const sell = () => {};

    return harden({
        fetchExternalPrice,
        sell,
    });
};
harden(makeOsmosisManager);

export { makeOsmosisManager };
