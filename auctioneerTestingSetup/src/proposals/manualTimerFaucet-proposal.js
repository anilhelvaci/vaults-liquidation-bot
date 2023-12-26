import { E } from '@endo/far';
import { makeTracer } from '@agoric/internal';

const trace = makeTracer('ManualTimer');

export const initManualTimerFaucet = async powers => {
    trace('InitManualTimerFaucet...');

    const {
        consume: { zoe },
        produce: { manualTimerKit },
        installation: {
            consume: { manualTimerInstallation },
            produce: { manualTimerInstallation: manualTimerInstallReset },
        },
        instance: {
            produce: { manualTimerInstanceNew },
        },
    } = powers;

    const SECONDS_PER_DAY = 24n * 60n * 60n;

    const terms = harden({
        startValue: 0n,
        timeStep: SECONDS_PER_DAY * 7n,
    });

    const installation = await manualTimerInstallation;
    const instanceFacets = await E(zoe).startInstance(installation, undefined, terms, undefined, 'manualTimerFaucet');

    manualTimerKit.reset();
    manualTimerKit.resolve(instanceFacets);
    manualTimerInstanceNew.reset();
    manualTimerInstanceNew.resolve(instanceFacets.instance);
    manualTimerInstallReset.reset();
    trace('Completed...');
};

export const getManifestForInitManualTimerFaucet = async ({ restoreRef }, { contractRef }) =>
    harden({
        manifest: {
            [initManualTimerFaucet.name]: {
                consume: {
                    zoe: 'zoe',
                },
                produce: {
                    manualTimerKit: true,
                },
                installation: {
                    consume: {
                        manualTimerInstallation: true,
                    },
                    produce: {
                        manualTimerInstallation: true,
                    },
                },
                instance: {
                    produce: {
                        manualTimerInstanceNew: true,
                    },
                },
            },
        },
        installations: {
            manualTimerInstallation: restoreRef(contractRef),
        },
    });
