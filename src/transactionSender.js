/**
 * @file This module is intended to contain code for sending offerSpecs to the actual blockchain.
 * So it can be considered as an implementation of OfferSender interface.
 */

import { execFileSync } from 'child_process';
import { pollTx } from '../_agstate/yarn-links/agoric/src/lib/chain.js';
import { makeTracer } from '@agoric/internal/src/index.js';

const trace = makeTracer('TransactionSender', true);

const agdBin = 'agd';
const sleep = ms => new Promise(res => setTimeout(res, ms));

const SIGN_BROADCAST_OPTS = (rpc, chainID) => [
    '--keyring-backend=test',
    '--chain-id',
    chainID,
    '--gas=auto',
    '--fees=10000ubld', // Avg fee in Keplr
    '--gas-adjustment=1.3',
    '--yes',
    '--node',
    rpc,
    '--output',
    'json',
];

const agd = {
    tx: {
        swingset: {
            // Offer = cap data
            walletAction: (offer, from, rpc, chainID) => [
                'tx',
                'swingset',
                'wallet-action',
                offer,
                `--from=${from}`,
                '--allow-spend',
                ...SIGN_BROADCAST_OPTS(rpc, chainID),
            ],
        },
    },
};

const execute = (args, options = {}) => {
    trace('Executing', args);
    return execFileSync(agdBin, args, { encoding: 'utf-8', ...options });
};

const sendWalletAction = (offer, from, rpc, chainID) => {
    const tx = execute(agd.tx.swingset.walletAction(offer, from, rpc, chainID));
    const { txhash } = JSON.parse(tx);
    return pollTx(txhash, {
        execFileSync,
        delay: sleep,
        rpcAddrs: [rpc],
    });
};

const makeTransactionSender = async ({ networkConfig, marshaller, from }) => {
    const result = await fetch(networkConfig);
    const {
        chainName,
        rpcAddrs: [rpc],
    } = await result.json();
    trace('makeTransactionSender', chainName, rpc);

    const send = offerSpec => {
        trace('send', offerSpec);
        const spendAction = {
            method: 'executeOffer',
            offer: offerSpec,
        };

        const offer = JSON.stringify(marshaller.toCapData(harden(spendAction)));
        return sendWalletAction(offer, from, rpc, chainName);
    };

    const cancel = offerId => {
        trace('cancel', offerId);
        const spendAction = {
            method: 'tryExitOffer',
            offerId,
        };

        const offer = JSON.stringify(marshaller.toCapData(harden(spendAction)));
        return sendWalletAction(offer, from, rpc, chainName);
    };

    return harden({
        send,
        cancel,
    });
};
harden(makeTransactionSender);

export { makeTransactionSender };
