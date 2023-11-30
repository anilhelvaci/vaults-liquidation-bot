import { E } from '@endo/far';
import { deeplyFulfilledObject, makeTracer } from '@agoric/internal';
import { makeGovernedTerms } from '@agoric/inter-protocol/src/auction/params.js';

const trace = makeTracer('FakeAuctioneer');

export const SECONDS_PER_MINUTE = 60n;
export const SECONDS_PER_HOUR = 60n * 60n;
export const SECONDS_PER_DAY = 24n * SECONDS_PER_HOUR;

/**
 * @param {EconomyBootstrapPowers} powers
 * @param {object} config
 * @param {any} [config.auctionParams]
 */
export const initAuctioneer = async (powers) => {
  trace('InitAuctioneer...');

  const {
    consume: {
      zoe,
      board,
      priceAuthority,
      chainStorage,
      economicCommitteeCreatorFacet: electorateCreatorFacet,
      manualTimerFaucetKit,
    },
    produce: { fakeAuctioneerKit },
    instance: {
      produce: { fakeAuctioneer: auctionInstance },
      consume: { reserve: reserveInstance },
    },
    installation: {
      consume: {
        fakeAuctioneer: auctionInstallation,
        contractGovernor: contractGovernorInstallation,
      },
    },
    issuer: {
      consume: { IST : istIssuerP },
    },
  } = powers;

  const { publicFacet: manualTimerPublicFacet } = await manualTimerFaucetKit;
  const manualTimer = await E(manualTimerPublicFacet).getManualTimer()

  const auctionParams = {
    StartFrequency: 1n * SECONDS_PER_HOUR,
    ClockStep: 3n * SECONDS_PER_MINUTE,
    StartingRate: 10500n,
    LowestRate: 6500n,
    DiscountStep: 500n,
    AuctionStartDelay: 2n,
    PriceLockPeriod: SECONDS_PER_HOUR / 2n,
  };

  const poserInvitationP = E(electorateCreatorFacet).getPoserInvitation();

  const [initialPoserInvitation, electorateInvitationAmount] =
    await Promise.all([
      poserInvitationP,
      E(E(zoe).getInvitationIssuer()).getAmountOf(poserInvitationP),
    ]);

  const timerBrand = await E(manualTimer).getTimerBrand();

  const marshaller = await E(board).getPublishingMarshaller();
  const storageNode = await E(chainStorage).makeChildNode('fakeAuction');

  const reservePublicFacet = await E(zoe).getPublicFacet(reserveInstance);

  const auctionTerms = makeGovernedTerms(
    { storageNode, marshaller },
    manualTimer,
    priceAuthority,
    reservePublicFacet,
    {
      ...auctionParams,
      ElectorateInvitationAmount: electorateInvitationAmount,
      TimerBrand: timerBrand,
    },
  );

  const bidIssuer = await istIssuerP;

  const governorTerms = await deeplyFulfilledObject(
    harden({
      timer: manualTimer,
      governedContractInstallation: auctionInstallation,
      governed: {
        terms: auctionTerms,
        issuerKeywordRecord: { Bid: bidIssuer },
        storageNode,
        marshaller,
        label: 'auctioneer',
      },
    }),
  );

  trace('Start auctioneer instance...');
  /** @type {GovernorStartedInstallationKit<typeof auctionInstallation>} */
  const governorStartResult = await E(zoe).startInstance(
    contractGovernorInstallation,
    undefined,
    governorTerms,
    harden({
      electorateCreatorFacet,
      governed: {
        initialPoserInvitation,
        storageNode,
        marshaller,
      },
    }),
    'auctioneer.governor',
  );

  const [governedInstance, governedCreatorFacet, governedPublicFacet] =
    await Promise.all([
      E(governorStartResult.creatorFacet).getInstance(),
      E(governorStartResult.creatorFacet).getCreatorFacet(),
      E(governorStartResult.creatorFacet).getPublicFacet(),
    ]);

  trace('Update kits...');
  fakeAuctioneerKit.resolve(
    harden({
      label: 'fakeAuctioneer',
      creatorFacet: governedCreatorFacet,
      adminFacet: governorStartResult.adminFacet,
      publicFacet: governedPublicFacet,
      instance: governedInstance,

      governor: governorStartResult.instance,
      governorCreatorFacet: governorStartResult.creatorFacet,
      governorAdminFacet: governorStartResult.adminFacet,
    }),
  );

  auctionInstance.resolve(governedInstance);
  trace('Completed...');
};

export const getManifestForInitAuctioneer = async (
  { restoreRef },
  { contractRef },
) =>
  harden({
    manifest: {
      [initAuctioneer.name]: {
        consume: {
          zoe: 'zoe',
          board: true,
          priceAuthority: true,
          chainStorage: true,
          economicCommitteeCreatorFacet: true,
          manualTimerFaucetKit: true,
        },
        produce: {
          fakeAuctioneerKit: true,
        },
        instance: {
          consume: {
            reserve: true,
          },
          produce: {
            fakeAuctioneer: true,
          },
        },
        installation: {
          consume: {
            fakeAuctioneer: true,
            contractGovernor: true,
          },
        },
        issuer: {
          consume: { IST: true },
        },
      },
    },
    installations: {
      fakeAuctioneer: restoreRef(contractRef),
    },
  });
