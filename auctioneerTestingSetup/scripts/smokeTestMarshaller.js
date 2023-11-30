/* eslint-disable import/no-unresolved */
// assetList.js and referenceList.js files will be generated

import { Far, makeMarshal } from '@endo/marshal';
import referenceList from './referenceList.js';
import assetList from './assetList.js';

const ingestAgoricNamesAssets = (ingest) => {
  const assets = {};

  for (const [keyword, { issuer, brand }] of Object.entries(assetList)) {
    const remoteBrand = Far(`${keyword}Brand`, {});
    const remoteIssuer = Far(`${keyword}Issuer`, {});
    ingest(remoteBrand, brand);
    ingest(remoteIssuer, issuer);
    assets[keyword] = { brand: remoteBrand, issuer: remoteIssuer };
  }

  return harden(assets);
};

const makeLocalBoard = () => {
  const valToSlot = new Map();
  const slotToVal = new Map();

  const convertValToSlot = (val) => {
    return valToSlot.get(val);
  };

  const convertSlotToVal = (slot) => {
    return slotToVal.get(slot);
  };

  const ingest = (val, slot) => {
    slotToVal.set(slot, val);
    valToSlot.set(val, slot);
  };

  return harden({
    convertSlotToVal,
    convertValToSlot,
    ingest,
  });
};

const initLocalBoard = () => {
  const { convertValToSlot, convertSlotToVal, ingest } = makeLocalBoard();

  const auctioneerInstance = Far('fakeAuctioneer Instance', {});
  const manualTimerInstance = Far('manualTimerFaucet Instance', {});
  const istFaucetInstance = Far('fakeISTFaucet Instance', {});
  const atomFaucetInstance = Far('fakeATOMFaucet Instance', {});
  // const priceFeedInstance = Far('fakePriceFeed Instance', {});

  ingest(auctioneerInstance, referenceList.auctioneerInstance);
  ingest(manualTimerInstance, referenceList.manualTimerInstance);
  ingest(istFaucetInstance, referenceList.istFaucetInstance);
  ingest(atomFaucetInstance, referenceList.atomFaucetInstance);
  // ingest(priceFeedInstance, referenceList.priceFeedInstance);

  const instances = {
    auctioneerInstance,
    manualTimerInstance,
    istFaucetInstance,
    atomFaucetInstance,
    // priceFeedInstance,
  };

  const assets = ingestAgoricNamesAssets(ingest);

  return {
    table: {
      convertValToSlot,
      convertSlotToVal,
      ingest,
    },
    instances,
    assets,
  };
};

const makeSmokeTestMarshaller = () => {
  const { table, instances, assets } = initLocalBoard();

  const { serialize, unserialize } = makeMarshal(
    table.convertValToSlot,
    table.convertSlotToVal,
    {
      serializeBodyFormat: 'smallcaps',
      marshalSaveError: (_err) => {},
      errorTagging: 'off',
    },
  );

  return {
    serialize,
    unserialize,
    table,
    instances,
    assets,
  };
};

harden(makeSmokeTestMarshaller);
export { makeSmokeTestMarshaller };
