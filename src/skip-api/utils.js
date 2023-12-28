import chainsPkg from "@skip-router/core/dist/cjs/chains.js";
import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

let chains;

/**
 * @param {string} chainId 
 */
const getChainInfo = (chainId) => {
    if (!chains) chains = chainsPkg.default();
    const chainInfo = chains.find(chain => chain.chain_id === chainId);
    return chainInfo;
}
// harden(getChainInfo);

/**
 * @param {string} chainId 
 */
const getBech32Prefix = (chainId) => {
    const info = getChainInfo(chainId);
    return info.bech32_prefix;
}
// harden(getBech32Prefix);

/**
 * @param {string} chainId 
 * @param {number?} index
 */
const getHdWalletPath = (chainId, index = 0) => {
    const info = getChainInfo(chainId);
    return stringToPath(`m/44'/${info.slip44}'/0'/0/${index}`);
}
// harden(getHdWalletPath);

/**
 * @param {string} chainID
 * @param {string} mnemonic
 * @param {number?} index
 */
const getSigner = async (chainID, mnemonic, index = 0) => {
    const prefix = getBech32Prefix(chainID);
    const hdPaths = [getHdWalletPath(chainID, index)];

    return await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix, hdPaths });
}
// harden(getSigner);

/**
 * @param {DirectSecp256k1HdWallet} wallet 
 */
const getAddressFromSigner = async (wallet) => {
    const [{ address }] = await wallet.getAccounts();
    return address;
}
// harden(getAddressFromSigner);

export {
    getChainInfo,
    getBech32Prefix,
    getHdWalletPath,
    getSigner,
    getAddressFromSigner
};