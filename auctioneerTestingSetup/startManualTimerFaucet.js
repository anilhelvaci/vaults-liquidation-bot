// This is generated by writeCoreProposal; please edit!
/* eslint-disable */

const manifestBundleRef = {bundleID:"b1-0f1fd07dae8955cd71c59802c743b3c490558f4a67c3aaff3294facc4bf0329243ad77d82c295c3cd58da8dad845c7095b81493fa9c6a1c7b63bd97a471e04e8"};
const getManifestCall = harden([
  "getManifestForInitManualTimerFaucet",
  {
    contractRef: {
      bundleID: "b1-579ea40e21d905b97f69045c4f80599076810d5a3c4177d61cbf8990d7cd245e29f67110fb5f44e2e507467ae49fd83999b0bedae0985c7a69818a7c370bd0ce",
    },
  },
]);
const overrideManifest = {
  initManualTimerFaucet: {
    consume: {
      zoe: "zoe",
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
    produce: {
      manualTimerFaucetKit: true,
    },
  },
};

// Make the behavior the completion value.
(({
  manifestBundleRef,
  getManifestCall,
  overrideManifest,
  E,
  log = console.info,
  restoreRef: overrideRestoreRef,
}) => {
  const { entries, fromEntries } = Object;

  // deeplyFulfilled is a bit overkill for what we need.
  const shallowlyFulfilled = async obj => {
    if (!obj) {
      return obj;
    }
    const ents = await Promise.all(
      entries(obj).map(async ([key, valueP]) => {
        const value = await valueP;
        return [key, value];
      }),
    );
    return fromEntries(ents);
  };

  /** @param {ChainBootstrapSpace & BootstrapPowers & { evaluateBundleCap: any }} allPowers */
  const behavior = async allPowers => {
    // NOTE: If updating any of these names extracted from `allPowers`, you must
    // change `permits` above to reflect their accessibility.
    const {
      consume: { vatAdminSvc, zoe, agoricNamesAdmin },
      evaluateBundleCap,
      installation: { produce: produceInstallations },
      modules: {
        utils: { runModuleBehaviors },
      },
    } = allPowers;
    const [exportedGetManifest, ...manifestArgs] = getManifestCall;

    const defaultRestoreRef = async ref => {
      // extract-proposal.js creates these records, and bundleName is
      // the name under which the bundle was installed into
      // config.bundles
      const p = ref.bundleName
        ? E(vatAdminSvc).getBundleIDByName(ref.bundleName)
        : ref.bundleID;
      const bundleID = await p;
      const label = bundleID.slice(0, 8);
      return E(zoe).installBundleID(bundleID, label);
    };
    const restoreRef = overrideRestoreRef || defaultRestoreRef;

    // Get the on-chain installation containing the manifest and behaviors.
    console.info('evaluateBundleCap', {
      manifestBundleRef,
      exportedGetManifest,
      vatAdminSvc,
    });
    let bcapP;
    if ('bundleName' in manifestBundleRef) {
      bcapP = E(vatAdminSvc).getNamedBundleCap(manifestBundleRef.bundleName);
    } else {
      bcapP = E(vatAdminSvc).getBundleCap(manifestBundleRef.bundleID);
    }
    const bundleCap = await bcapP;

    const manifestNS = await evaluateBundleCap(bundleCap);

    console.error('execute', {
      exportedGetManifest,
      behaviors: Object.keys(manifestNS),
    });
    const {
      manifest,
      options: rawOptions,
      installations: rawInstallations,
    } = await manifestNS[exportedGetManifest](
      harden({ restoreRef }),
      ...manifestArgs,
    );

    // Await references in the options or installations.
    const [options, installations] = await Promise.all(
      [rawOptions, rawInstallations].map(shallowlyFulfilled),
    );

    // Publish the installations for behavior dependencies.
    const installAdmin = E(agoricNamesAdmin).lookupAdmin('installation');
    await Promise.all(
      entries(installations || {}).map(([key, value]) => {
        produceInstallations[key].resolve(value);
        return E(installAdmin).update(key, value);
      }),
    );

    // Evaluate the manifest for our behaviors.
    return runModuleBehaviors({
      allPowers,
      behaviors: manifestNS,
      manifest: overrideManifest || manifest,
      makeConfig: (name, _permit) => {
        log('coreProposal:', name);
        return { options };
      },
    });
  };

  // Make the behavior the completion value.
  return behavior;
})({ manifestBundleRef, getManifestCall, overrideManifest, E });
