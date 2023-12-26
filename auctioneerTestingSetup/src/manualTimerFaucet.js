// @ts-check
import { Far } from '@endo/marshal';
import buildManualTimer from '@agoric/zoe/tools/manualTimer.js';
import { TimeMath } from '@agoric/time';

export const start = async zcf => {
    const { startValue, timeStep } = zcf.getTerms();

    const manualTimer = buildManualTimer(console.log, startValue, timeStep);

    const advanceTimeHandler = async (seat, offerArgs) => {
        const { timestamp: timeRaw } = offerArgs;
        const timestamp = TimeMath.coerceTimestampRecord(timeRaw, manualTimer.getTimerBrand());
        await manualTimer.advanceTo(timestamp, 'New Time');
        return `Time advanced to ${timestamp}`;
    };

    const creatorFacet = Far('creatorFacet', {});

    const publicFacet = Far('publicFacet', {
        getManualTimer: () => manualTimer,
        getCurrentTimestamp: () => manualTimer.getCurrentTimestamp(),
        makeAdvanceTimeInvitation: () => zcf.makeInvitation(advanceTimeHandler, 'advanceTimeHandler'),
    });

    return harden({ creatorFacet, publicFacet });
};
