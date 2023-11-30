import { E } from '@endo/far';
import { makeTracer } from '@agoric/internal';

const trace = makeTracer('AssetFaucet');

export const initAssetFaucet = async (powers) => {
  trace('InitAssetFaucet...');

  const {
    consume: { zoe, board, chainStorage, agoricNamesAdmin },
    produce: { assetFaucetKit },
    installation: {
      consume: { assetFaucetInstallation },
    },
  } = powers;

  const installation = await assetFaucetInstallation;

  const fakeIstTerms = {
    keyword: 'FakeIST',
    assetKind: 'nat',
    displayInfo: { decimalPlaces: 6 },
  };

  const fakeAtomTerms = {
    keyword: 'FakeATOM',
    assetKind: 'nat',
    displayInfo: { decimalPlaces: 6 },
  };

  const fakeIstFacets = await E(zoe).startInstance(
    installation,
    undefined,
    fakeIstTerms,
    undefined,
    'FakeISTFaucet',
  );

  const fakeAtomFacets = await E(zoe).startInstance(
    installation,
    undefined,
    fakeAtomTerms,
    undefined,
    'FakeATOMFaucet',
  );

  trace('Get agoricNamesAdmin...');
  const issuerAdminP = E(agoricNamesAdmin).lookupAdmin('issuer');
  const brandAdminP = E(agoricNamesAdmin).lookupAdmin('brand');
  const instanceAdminP = E(agoricNamesAdmin).lookupAdmin('instance');

  const fakeIstIssuerP = E(fakeIstFacets.publicFacet).getIssuer();
  const fakeAtomIssuerP = E(fakeAtomFacets.publicFacet).getIssuer();

  trace('Get fakeIST issuer and brand...');
  const [fakeIstIssuer, fakeAtomIssuer, fakeIstBrand, fakeAtomBrand] =
    await Promise.all([
      fakeIstIssuerP,
      fakeAtomIssuerP,
      E(fakeIstIssuerP).getBrand(),
      E(fakeAtomIssuerP).getBrand(),
    ]);

  trace('Update admins ...');
  await Promise.all([
    E(issuerAdminP).update('FakeIST', fakeIstIssuer),
    E(brandAdminP).update('FakeIST', fakeIstBrand),
    E(issuerAdminP).update('FakeATOM', fakeAtomIssuer),
    E(brandAdminP).update('FakeATOM', fakeAtomBrand),
    E(instanceAdminP).update('fakeISTFaucet', fakeIstFacets.instance),
    E(instanceAdminP).update('fakeATOMFaucet', fakeAtomFacets.instance),
  ]);

  const storageNode = E(chainStorage).makeChildNode('fakeAssetsFaucet');
  const marshaller = await E(board).getPublishingMarshaller();

  const publishBrandInfo = async (brand, marshaller) => {
    const [id, displayInfo, allegedName] = await Promise.all([
      E(board).getId(brand),
      E(brand).getDisplayInfo(),
      E(brand).getAllegedName(),
    ]);
    const node = E(storageNode).makeChildNode(id);
    const aux = await E(marshaller).toCapData(
      harden({ allegedName, displayInfo }),
    );
    await E(node).setValue(JSON.stringify(aux));
  };

  await Promise.all([
    publishBrandInfo(fakeIstBrand, marshaller),
    publishBrandInfo(fakeAtomBrand, marshaller),
  ]);

  trace('Update kits...');
  assetFaucetKit.reset();
  assetFaucetKit.resolve(
    harden({
      fakeIst: fakeIstFacets,
      fakeAtom: fakeAtomFacets,
    }),
  );

  trace('Completed...');
};

export const getManifestForInitAssetFaucet = async (
  { restoreRef },
  { contractRef },
) =>
  harden({
    manifest: {
      [initAssetFaucet.name]: {
        consume: {
          zoe: 'zoe',
          board: true,
          chainStorage: true,
          agoricNamesAdmin: true,
        },
        produce: {
          assetFaucetKit: true,
        },
        instance: {
          produce: {
            assetFaucetInstance: true,
          },
        },
        installation: {
          consume: {
            assetFaucetInstallation: true,
          },
        },
      },
    },
    installations: {
      assetFaucetInstallation: restoreRef(contractRef),
    },
  });
