import { E } from '@endo/far';
import fs from 'fs/promises';

const updateReferenceList = async (homeP, { pathResolve }) => {
  const { board, agoricNames } = await homeP;

  const [
    // auctioneerInstance,
    // manualTimerInstance,
    istFaucetInstance,
    atomFaucetInstance,
    // priceFeedInstance,
  ] = await Promise.all([
    // E(agoricNames).lookup('instance', 'fakeAuctioneer'),
    // E(agoricNames).lookup('instance', 'manualTimerFaucetInstance'),
    E(agoricNames).lookup('instance', 'fakeISTFaucet'),
    E(agoricNames).lookup('instance', 'fakeATOMFaucet'),
    // E(agoricNames).lookup('instance', 'fakePriceFeed'),
  ]);

  const [
    // auctioneerInstanceBoardId,
    // manualTimerInstanceBoardId,
    istFaucetInstanceBoardId,
    atomFaucetInstanceBoardId,
    // priceFeedInstanceBoardId,
  ] = await Promise.all([
    // E(board).getId(auctioneerInstance),
    // E(board).getId(manualTimerInstance),
    E(board).getId(istFaucetInstance),
    E(board).getId(atomFaucetInstance),
    // E(board).getId(priceFeedInstance),
  ]);

  const updatedReferences = {
    // auctioneerInstance: auctioneerInstanceBoardId,
    // manualTimerInstance: manualTimerInstanceBoardId,
    istFaucetInstance: istFaucetInstanceBoardId,
    atomFaucetInstance: atomFaucetInstanceBoardId,
    // priceFeedInstance: priceFeedInstanceBoardId,
  };

  console.log('LOG: updatedReferences ', { updatedReferences });

  const defaultsFile = pathResolve(`./referenceList.js`);
  console.log('writing', defaultsFile);
  const defaultsContents = `\
  // GENERATED FROM ${pathResolve('./updateReferenceList.js')}
  export default ${JSON.stringify(updatedReferences, undefined, 2)};
  `;
  await fs.writeFile(defaultsFile, defaultsContents);

  console.log('Done.');
};

export default updateReferenceList;
