import { M } from '@endo/patterns';

export const DELTA_SHAPE = harden({
    type: M.string(),
    value: M.nat(),
});

export const SPEND_TYPE_SHAPE = harden(
    M.or(
        {
            type: 'flash',
        },
        {
            type: 'controlled',
            controlFactor: M.nat(),
        },
    ),
);
