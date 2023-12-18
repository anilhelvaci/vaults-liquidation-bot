import { M } from '@endo/patterns';

export const DELTA_SHAPE = harden({
    type: M.string(),
    value: M.nat(),
});

export const SPEND_TYPE_SHAPE = harden({
    type: M.or('flash', 'controlled'),
});
