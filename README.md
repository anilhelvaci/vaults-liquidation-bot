# vaults-liquidation-bot [DRAFT]
A piece of software that automates the bidding process for The Inter Protocol's vault liquidation auctions. Suitable for arbitrageurs and/or individual use. 

## Disclaimer
This bot is **NOT** tested on Mainnet, yet. Use it with caution. You would be contributing 
to the project if you run this against Mainnet.

## How to run it
This is a Nodejs project that hasn't made its way to a frontend yet. This means
you'll need a text editor, like VSCode, to edit [strategy.config.js](strategy.config.js) before running.
See [Anatomy of the strategy.config.js]() for detailed explanation.
### Prerequisites
Here are the host machine requirements to run the bot;
* A shell terminal (zsh, bash, etc.)
* Nodejs > 16 LTS
* agoric-sdk: `agoric-upgrade-13`
  * See [prerequisites for agoric-sdk here](https://docs.agoric.com/guides/getting-started/#installing-prerequisites)
* agd: `0.35.0-u13.0`

### Install `agoric-sdk`
```shell
## SDK_PATH = This can be any path you choose to install the sdk on your machine
cd $SDK_PATH
git clone https://github.com/Agoric/agoric-sdk.git
cd agoric-sdk
git checkout agoric-upgrade-13
yarn && yarn build
yarn link-cli ~/bin/agoric

## Now build `agd`
cd packages/cosmic-swingset
make
```

Check both `agoric` and `agd` installed properly

```shell
agoric --version
## Should output => 0.22.0-u13.0

agd version
## Should output => 0.35.0-u13.0
```

### Signing Account
The liquidation bot sends transactions on behalf of the user. This means that it 
needs an account to sign transactions with sufficient fees in it. Follow below steps
according to your need;
1. **Add an existing account with mnemonic**
   ```shell
   agd keys add {acct_name} --recover --keyring-backend=test
   > Enter your bip39 mnemonic
   ## Paste your mnemonic here 
   ```
2. **Create a new account**
   ```shell
   agd keys add {acct_name} --keyring-backend=test
   ```
   
   Which should output something like:
   
   ```json
   {
    "name": "docs",
    "type": "local",
    "address": "agoric1pv9mcxmfcjra06wf7c8y3yen4wwcex4vsl53dm",
    "pubkey": "{\"@type\":\"/cosmos.crypto.secp256k1.PubKey\",\"key\":\"A4ta203DSie8avPF0jJwybGWczoaDM5I4e2TYSsKVCjF\"}",
    "mnemonic": "oven sting ridge benefit live sibling squeeze minimum coast claw abuse human priority pony panel holiday upper few people cancel eye lucky shed try"
   }
   ```

   > Please write down this mnemonic to somewhere safe!

### Send IST to the signing account
Liquidation happens by buying the collateral asset using IST which means the agoric
account bot uses must have some amount of IST credit in its balance so that the bot
can build and send valid offers. 

You can use the [options here](https://inter.trade/find#all) to find IST or just send
it from another account.

### Anatomy of the `strategy.config.js`
Before you run the bot you must first adjust the config file, `strategy.config.js` 
in our case, to serve your specific purposes.



### Running the bot

## Analyze what happened