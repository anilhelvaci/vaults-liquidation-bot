import { E } from '@endo/far';
import { makeTracer } from '@agoric/internal';

const trace = makeTracer('ManualTimer');

export const initManualTimerFaucet = async (powers) => {
  trace('InitManualTimerFaucet...');
  
  const {
    consume: { zoe },
    produce: { manualTimerFaucetKit },
    installation: {
      consume: { manualTimerFaucetInstallation },
    },
    instance: {
      produce: { manualTimerFaucetInstance },
    },
  } = powers;

  const SECONDS_PER_DAY = 24n * 60n * 60n;

  const terms = harden({
    startValue: 0n,
    timeStep: SECONDS_PER_DAY * 7n,
  });

  const installation = await manualTimerFaucetInstallation;
  const instanceFacets = await E(zoe).startInstance(
    installation,
    undefined,
    terms,
    undefined,
    'manualTimerFaucet',
  );

  manualTimerFaucetKit.reset();
  manualTimerFaucetKit.resolve(instanceFacets);
  manualTimerFaucetInstance.reset();
  manualTimerFaucetInstance.resolve(instanceFacets.instance);

  trace('Completed...');
};

export const getManifestForInitManualTimerFaucet = async (
  { restoreRef },
  { contractRef },
) =>
  harden({
    manifest: {
      [initManualTimerFaucet.name]: {
        consume: {
          zoe: 'zoe',
        },
        produce: {
          manualTimerFaucetKit: true,
        },
        installation: {
          consume: {
            manualTimerFaucetInstallation: true,
          },
        },
        instance: {
          produce: {
            manualTimerFaucetInstance: true,
          },
        },
      },
    },
    installations: {
      manualTimerFaucetInstallation: restoreRef(contractRef),
    },
  });
