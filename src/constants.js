const StateUpdates = {
    BOOK: 'book',
    GOVERNANCE: 'governance',
    SCHEDULE: 'schedule',
    TERMINATE: 'terminate',
};
harden(StateUpdates);

const RETRY_LIMIT = 3;
const MILI_SEC = 1000n;

const BID_BRAND_NAME = 'IST';

const StateManagerKeys = harden({
    BID_BRAND: 'bidBrand',
    COLLATERAL_BRAND: 'colBrand',
    BOOK_STATE: 'bookState',
    SCHEDULE_STATE: 'scheduleState',
    GOVERNANCE_STATE: 'governanceState',
    WALLET_UPDATE: 'walletUpdate',
    CREDIT_MANAGER: 'creditManager',
});

export {
    StateUpdates,
    BID_BRAND_NAME,
    StateManagerKeys,
    RETRY_LIMIT,
    MILI_SEC,
};