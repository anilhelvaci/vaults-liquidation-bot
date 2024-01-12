# vaults-liquidation-bot
A piece of software that automates the bidding process for The Inter Protocol's vault liquidation auctions. Suitable for arbitrageurs and/or individual use. 

## Disclaimer
This bot is **NOT** tested on Mainnet, yet. Use it with caution. You would be contributing 
to the project if you run this against Mainnet.

## How to run it
This is a Nodejs project that hasn't made its way to a frontend yet. This means
you'll need a text editor, like VSCode, to edit [strategy.config.js](strategy.config.js) before running.
See [Anatomy of the strategy.config.js](#anatomy-of-the-strategyconfigjs) for detailed explanation.
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
account bot users must have some amount of IST credit in its balance so that the bot
can build and send valid offers. 

You can use the [options here](https://inter.trade/find#all) to find IST or just send
it from another account.

### Anatomy of the `strategy.config.js`
Before you run the bot you must first adjust the config file, `strategy.config.js` 
in our case, to serve your specific purposes.

**What can you do with this config file?**
* Specify the account name and address for signing transactions
* Choose how your bot behaves when buying collateral from an auction

Here's the structure of the config file;
```js
export default harden({
    account: {
        name: 'user1',
        address: 'agoric1qupryrguze6d4p9rrw6f2rnytqll7pahpk65ru',
    },
    strategies: [
       {
          delta: {
             type: 'exact',
             value: 500000n, // 0.5 IST
          },
          spend: {
             type: 'flash',
          },
          credit: 100_000_000n, // 100 IST credit
          collateralName: 'ATOM',
          bookId: 0,
          retryInterval: 30 * 1000, // 30 seconds in ms
          maxSellValue: 1000_000_000n, // Can sell 1k ATOM max to avoid big price impacts on Osmosis
       },
       ...
    ],
});
```

**What strategies are available?**

Liquidation bot works by comparing the `currentPriceLevel` coming from the `vstorage`
to the starting price of the auction. It waits until a pre-determined difference
between two prices occurs and only then it places the bids.
* `delta`: The predetermined amount of difference.
  * `type`: `exact` | `percentage`. You can either specify an exact amount of difference
like 0.5 IST or percentage from the starting price like `3% off from the starting price`
  * `value`: Changes according to what the `type` is set to. For instance, when `type === 'exact'`
the `value` can be 500000uist if the user wants a 0.5 IST difference. If `type === 'percentage'`
the `value` would be 3n for 3% difference from the starting price.

* `spend`: Specifies how the amount of credit assigned to the bot will be spent.
  * `type`: Possible values `flash` | `controlled`
    * `flash`: Uses the whole credit to place one bid
    * `controlled`: Splits the credit into smaller amounts and uses those small amounts
to place multiple bids as the `currentPriceLevel` keeps going down.
  * `controlFactor`: Optional. Only used when `type === controlled`. A bigint that
is used to calculate the following formula => `amountIn = credit / controlFactor`

* `credit`: Total value of `uist` this bot is allowed to spend.
* `collateralName`: Name of the collateral.
* `bookId`: Variable used to calculate the path for => `published.auctioneer.{bookID}` in `vstorage`
* `retryInterval`: Used for an arbitrage case that is not supported yet. 
* `maxSellValue`: Used for an arbitrage case that is not supported yet. 

### Running the bot
Open a new terminal;

```shell
## LIQUIDATION_BOT_PATH = This can be any place you wish to install this project on your host machine
cd $LIQUIDATION_BOT_PATH
git clone https://github.com/anilhelvaci/vaults-liquidation-bot.git
cd vaults-liquidation-bot
agoric install
./liquidate.sh
```

A window to a file named `liquidate-logs.txt` should pop up showing logs after `liquidate.sh` is invoked.

## Analyze what happened
When you kill the process running the liquidation bot, there are two files guaranteed to 
be created. Namely;
* `liquidate-logs.txt`: Contains the full logs of the process. Mostly for debugging.
* `bids-{timestamp}.log.json`: Contains the history of the bids.

There's one more file to be created if any error occurs;
* `error-{timestamp}.log`: Contains any thrown error messages and their regarding stack traces.

### What data does the bid log contain?
Bid log comprises of the decisions liquidation bot made when an update from the
auction is received along with a state snapshot used in the decision process at the
time of update received.

There are four possible bid log values;
* `No Bid`

  Bot made the comparison between the current prices and desired price then decided 
not to bid. Here are the properties;
  * `msg`: "No Bid"
  * `data`: A full snapshot of the bot's state at that point in time
     <details>
      <summary>Sample</summary> 

      ```json
      {
        "msg": "No Bid",
        "data": {
          "bidBrand": {},
          "colBrand": {},
          "bookState": {
            "collateralAvailable": {
              "brand": {},
              "value": "1000000000"
            },
            "currentPriceLevel": {
              "numerator": {
                "brand": {},
                "value": "7850000"
              },
              "denominator": {
                "brand": {},
                "value": "1000000"
              }
            },
            "remainingProceedsGoal": {
              "brand": {},
              "value": "35000000"
            },
            "startCollateral": {
              "brand": {},
              "value": "1000000000"
            },
            "startPrice": {
              "denominator": {
                "brand": {},
                "value": "1000000"
              },
              "numerator": {
                "brand": {},
                "value": "7850000"
              }
            },
            "startProceedsGoal": {
              "brand": {},
              "value": "35000000"
            }
          },
          "scheduleState": {
            "activeStartTime": {
              "absValue": "43202",
              "timerBrand": {}
            },
            "nextDescendingStepTime": {
              "absValue": "43562",
              "timerBrand": {}
            },
            "nextStartTime": {
              "absValue": "46802",
              "timerBrand": {}
            }
          },
          "governanceState": {
            "current": {
              "AuctionStartDelay": {
                "type": "relativeTime",
                "value": {
                  "relValue": "2",
                  "timerBrand": {}
                }
              },
              "ClockStep": {
                "type": "relativeTime",
                "value": {
                  "relValue": "180",
                  "timerBrand": {}
                }
              },
              "DiscountStep": {
                "type": "nat",
                "value": "500"
              },
              "Electorate": {
                "type": "invitation",
                "value": {
                  "brand": {},
                  "value": [
                    {
                      "description": "questionPoser",
                      "handle": {},
                      "installation": {},
                      "instance": {}
                    }
                  ]
                }
              },
              "LowestRate": {
                "type": "nat",
                "value": "6500"
              },
              "PriceLockPeriod": {
                "type": "relativeTime",
                "value": {
                  "relValue": "1800",
                  "timerBrand": {}
                }
              },
              "StartFrequency": {
                "type": "relativeTime",
                "value": {
                  "relValue": "3600",
                  "timerBrand": {}
                }
              },
              "StartingRate": {
                "type": "nat",
                "value": "10500"
              }
            }
          },
          "creditManager": {},
          "walletUpdate": {},
          "initialized": true,
          "offers": [],
          "worstDesiredPrice": {
            "numerator": {
              "brand": {},
              "value": "7550000"
            },
            "denominator": {
              "brand": {},
              "value": "1000000"
            }
          },
          "externalPrice": {
            "denominator": {
              "brand": {},
              "value": "1000000"
            },
            "numerator": {
              "brand": {},
              "value": "7850000"
            }
          }
        }
      }
      ```      

      </details>   
* `Bid Placed`
  
  Bot decided that current price satisfies the desired price and sent the bid offer
to the auction contract.
  * `msg`: "Bid Placed"
    * `data`:
      <details>
      <summary>Sample</summary> 

      ```json
        {
         "msg": "Bid Placed",
        "data": {
          "offerId": "place-bid-0-1704887308303",
          "bidUtils": {
            "bidAmount": {
              "brand": {},
              "value": "25000000"
            },
            "maxColAmount": {
              "brand": {},
              "value": "3352329"
            },
            "price": {
              "numerator": {
                "brand": {},
                "value": "7550000"
              },
              "denominator": {
                "brand": {},
                "value": "1000000"
              }
            }
          },
          "worstDesiredPrice": {
            "numerator": {
              "brand": {},
              "value": "7550000"
            },
            "denominator": {
              "brand": {},
              "value": "1000000"
            }
          },
          "externalPrice": {
            "denominator": {
              "brand": {},
              "value": "1000000"
            },
            "numerator": {
              "brand": {},
              "value": "7850000"
            }
          },
          "currentPriceLevel": {
            "numerator": {
              "brand": {},
              "value": "7457500"
            },
            "denominator": {
              "brand": {},
              "value": "1000000"
            }
          }
        }
      }
      ```      
        
      </details>
    
* `Already existing bid`
  
  Liquidation bot aims to place only one bid per auction price as the auction lowers 
the price by 5% on every clock step. This is what you'll see when the bot receives a state
update from the auction and there's already a bid placed for the auction's current price
at that point in time.
  * `msg`: "Already existing bid. Either pending or success"
  * `data`: Contains the placed bid's offer id and its state.
      <details>
      <summary>Sample</summary> 

      ```json
      {
        "msg": "Already existing bid. Either pending or success",
        "data": {
          "currentBid": {
          "offerId": "place-bid-2-1704887728055"
          }
         }
      }
      ```    

      </details>
* `Insufficient Credit`

  The bot stops trying to add new bids when there isn't enough credit left. You'll
see this as the last message in your bid log, most of the time.
  * `msg`: "Insufficient credit"
  * `data`: Contains information about how much credit is left how much the bot tried
to spend.
    
    <details>
    <summary>Sample</summary>
    
    ```json
    {
      "msg": "Insufficient credit",
      "data": {
        "bidUtils": {
          "bidAmount": {
            "brand": {},
            "value": "25000000"
          },
          "maxColAmount": {
            "brand": {},
            "value": "4549590"
          },
          "price": {
            "numerator": {
              "brand": {},
              "value": "7350000"
            },
            "denominator": {
              "brand": {},
              "value": "1000000"
            }
          }
        },
        "credit": {
          "brand": {},
          "value": "12"
        }
      }
    }
    ```
    </details>