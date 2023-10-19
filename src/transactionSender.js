/**
 * @file This module is intended to contain code for sending offerSpecs to the actual blockchain.
 * So it can be considered as an implementation of OfferSender interface.
 */
import { Far } from "@endo/far";

const makeTransactionSender = () => {
  console.log('Not implemented yet!');
  return Far('Empty OfferSender', {});
};
harden(makeTransactionSender);

export {
    makeTransactionSender
};