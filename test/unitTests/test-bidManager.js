// @ts-ignore

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';
import { makeTestContext, makeTestDriver } from "./setup.js";

test.before(async t => {
   t.context = await makeTestContext();
});

test.beforeEach(async t => {
    t.context.drivers = await makeTestDriver(t);
    console.log('----------------- TEST LOGS -----------------');
});

test('initial', async t => {
    const { drivers } = t.context;
    console.log({ drivers });
    t.pass();
});

