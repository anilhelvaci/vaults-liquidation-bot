const StateUpdates = {
    BOOK: 'book',
    GOVERNANCE: 'governance',
    SCHEDULE: 'schedule',
    TERMINATE: 'terminate',
};
harden(StateUpdates);

const BID_BRAND_NAME = 'IST';

/**
 * bidBrand: null,
 *         colBrand: null,
 *         bookState: null,
 *         scheduleState: null,
 *         governanceState: null,
 * @type {{}}
 */
const StateManagerKeys = harden({
    BID_BRAND: 'bidBrand',
    COLLATERAL_BRAND: 'colBrand',
    BOOK_STATE: 'bookState',
    SCHEDULE_STATE: 'scheduleState',
    GOVERNANCE_STATE: 'governanceState',
    WALLET_UPDATE: 'walletUpdate',
});

export {
    StateUpdates,
    BID_BRAND_NAME,
    StateManagerKeys,
};