// @ts-check
import { Far } from '@endo/marshal';
import buildManualTimer from '@agoric/zoe/tools/manualTimer.js';

export const start = async (zcf) => {
  const options = zcf.getTerms();

  const manualTimer = buildManualTimer(
    console.log,
    options.startValue,
    options.timeStep,
  );

  const advanceTimeHandler = async (seat, offerArgs) => {
    const { timestamp } = offerArgs;
    await manualTimer.tickN(timestamp);
    return `Time advanced to ${timestamp}`;
  };

  const timerOfferHandler = async () => {
    const invitationMaker = Far('timer invitationMakers', {
      advanceTime() {
        return zcf.makeInvitation(advanceTimeHandler, 'advanceTimeHandler');
      },
    });

    return invitationMaker;
  };

  const creatorFacet = Far('creatorFacet', {});

  const publicFacet = Far('publicFacet', {
    getManualTimer: () => manualTimer,
    getCurrentTimestamp: () => manualTimer.getCurrentTimestamp(),
    makeTimerInvitation: () =>
      zcf.makeInvitation(timerOfferHandler, 'timerOfferHandler'),
  });

  return harden({ creatorFacet, publicFacet });
};
