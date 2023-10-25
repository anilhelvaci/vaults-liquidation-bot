// @ts-ignore

import '@agoric/zoe/tools/prepare-test-env.js';
import test from 'ava';

// @ts-ignore
import { makeLiquidationTestContext } from '@agoric/boot/test/bootstrapTests/liquidation.ts';

test.before(async t => {
    t.context = await makeLiquidationTestContext(t);
});
test.after.always(t => {
    // @ts-ignore
    return t.context.shutdown && t.context.shutdown();
});

test.serial('initial', t => {
    console.log('INITIAL', t.context);
});
