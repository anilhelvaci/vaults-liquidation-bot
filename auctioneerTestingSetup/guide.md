```shell
cd auctioneerTestingSetup
make manual-timer-bundle
make manual-timer-submit-core-eval VOTE_PROPOSAL=1
make asset-faucet-bundle
make asset-faucet-submit-core-eval VOTE_PROPOSAL=2
make auctioneer-bundle
make auctioneer-submit-core-eval VOTE_PROPOSAL=3
```

```shell
agoric deploy auctioneerTestingSetup/scripts/updateAssetList.js 
agoric deploy auctioneerTestingSetup/scripts/updateReferenceList.js 
```