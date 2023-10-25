// @ts-nocheck
import './installSesLockdown.js';
import { makeAuctionWatcher } from "./src/auctionWatcher.js";
import { makeAuctionStateManager } from "./src/auctionState.js";
import { getConfig } from "./src/helpers.js";

const main = async () => {
    const config = getConfig();
    const { watch, marshaller } = makeAuctionWatcher(config.bookId);
    const stateManager = makeAuctionStateManager();
    watch(stateManager.updateState);
    await new Promise(resolve => setTimeout(resolve, 5000));
    stateManager.getState();
};


main();