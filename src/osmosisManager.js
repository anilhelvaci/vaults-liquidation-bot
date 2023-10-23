const makeOsmosisManager = () => {
    const checkCollateralPrice = () => {
        return Promise.resolve(7n);
    };

    const sendCollateralToOsmosis = () => {};

    const sellCollateralOnOsmosis = () => {};

    return harden({
        checkCollateralPrice,
        sendCollateralToOsmosis,
        sellCollateralOnOsmosis,
    });
};
harden(makeOsmosisManager);

export { makeOsmosisManager };
