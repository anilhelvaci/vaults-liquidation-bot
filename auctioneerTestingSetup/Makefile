SDK_ROOT = $(shell cd ../../agoric-11-wf >/dev/null && pwd)
AGORIC = $(SDK_ROOT)/packages/agoric-cli/bin/agoric
AGD = $(SDK_ROOT)/bin/agd
LOCAL_CHAIN_ID = agoriclocal

GAS = 50000000
GAS_ADJUSTMENT = 1.2
VOTE_PROPOSAL = 1
VOTE_OPTION = yes

HOME = $(SDK_ROOT)/packages/cosmic-swingset/t1/bootstrap
LOCAL_WALLET = bootstrap

# ====================================================     General Purpose   =================================================

vote:
	$(AGD) tx gov vote $(VOTE_PROPOSAL) $(VOTE_OPTION) \
		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --yes -b block


# ====================================================     Manual Timer   =================================================

MANUAL-TIMER-SCRIPT = ${shell pwd}/src/proposals/manualTimerFaucet-script.js

MANUAL-TIMER-CONTRACT_REF_BUNDLE_ID = @cache/manual-timer/b1-579ea40e21d905b97f69045c4f80599076810d5a3c4177d61cbf8990d7cd245e29f67110fb5f44e2e507467ae49fd83999b0bedae0985c7a69818a7c370bd0ce.json
MANUAL-TIMER-MANIFEST_REF_BUNDLE_ID = @cache/manual-timer/b1-0f1fd07dae8955cd71c59802c743b3c490558f4a67c3aaff3294facc4bf0329243ad77d82c295c3cd58da8dad845c7095b81493fa9c6a1c7b63bd97a471e04e8.json

manual-timer-bundle:
	rm -rf ${shell pwd}/cache/manual-timer/*
	${AGORIC} run ${MANUAL-TIMER-SCRIPT}

manual-timer-install-contract-bundle:
	${AGD} tx swingset install-bundle ${MANUAL-TIMER-CONTRACT_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

manual-timer-install-manifest-bundle:
	${AGD} tx swingset install-bundle ${MANUAL-TIMER-MANIFEST_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

manual-timer-submit-proposal:
	${AGD} tx gov submit-proposal swingset-core-eval startManualTimerFaucet-permit.json startManualTimerFaucet.js \
		--title="Enable manualTimerFaucet" --description="Evaluate startManualTimerFaucet.js" --deposit=1000000ubld \
		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --yes -b block

manual-timer-submit-core-eval: manual-timer-install-contract-bundle manual-timer-install-manifest-bundle manual-timer-submit-proposal vote


# ====================================================     Asset Faucet  =================================================

ASSET-FAUCET-SCRIPT = ${shell pwd}/src/proposals/assetFaucet-script.js

ASSET-FAUCET-CONTRACT_REF_BUNDLE_ID = @cache/asset-faucet/b1-53f076e76ccea9913a22b8197a050150b213a4f0df2aae9801b6b6673a9bac890eec3116da95d76a0751e729575a6d7c1d28c59fc78ef6faca110c47c11e0053.json
ASSET-FAUCET-MANIFEST_REF_BUNDLE_ID = @cache/asset-faucet/b1-22cfcfaa263d462f74922f5b8f606dc79d51cace6acdf9ffc98bb3aea657f2d6f2f956343739dc290de3b78668cfe5f88ec88657e9dc1beeb17ce9e52b345347.json

asset-faucet-bundle:
	rm -rf ${shell pwd}/cache/asset-faucet/*
	${AGORIC} run ${ASSET-FAUCET-SCRIPT}

asset-faucet-install-contract-bundle:
	${AGD} tx swingset install-bundle ${ASSET-FAUCET-CONTRACT_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

asset-faucet-install-manifest-bundle:
	${AGD} tx swingset install-bundle ${ASSET-FAUCET-MANIFEST_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

asset-faucet-submit-proposal:
	${AGD} tx gov submit-proposal swingset-core-eval startAssetFaucet-permit.json startAssetFaucet.js \
		--title="Enable asset-faucet" --description="Evaluate startAssetFaucet.js" --deposit=1000000ubld \
		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --yes -b block

asset-faucet-submit-core-eval: asset-faucet-install-contract-bundle asset-faucet-install-manifest-bundle asset-faucet-submit-proposal vote


# ====================================================     Price Feed  =================================================

PRICE-FEED-SCRIPT = ${shell pwd}/src/proposals/priceFeed-script.js

PRICE-FEED-CONTRACT_REF_BUNDLE_ID = @cache/price-feed/b1-18d599100b4a9f65827bc1a0bddbe3532e8061220074961587677d04a6f52abacb7c87a6b552102539b630af4184705cfb34b56e23de718e99d17591aeb87e40.json
PRICE-FEED-MANIFEST_REF_BUNDLE_ID = @cache/price-feed/b1-bfa72ad2d6bdaef9477901bfca0a5d381781f0e9f4f3066901d674ce812be9678059670f36e62be9baf44592b8d037a62b7d6c4de60f4d47f31afe62c7a2ce20.json

price-feed-bundle:
	rm -rf ${shell pwd}/cache/price-feed/*
	${AGORIC} run $(PRICE-FEED-SCRIPT)

price-feed-install-contract-bundle:
	${AGD} tx swingset install-bundle ${PRICE-FEED-CONTRACT_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

price-feed-install-manifest-bundle:
	${AGD} tx swingset install-bundle ${PRICE-FEED-MANIFEST_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

price-feed-submit-proposal:
	${AGD} tx gov submit-proposal swingset-core-eval startPriceFeed-permit.json startPriceFeed.js \
		--title="Enable priceFeed" --description="Evaluate startPriceFeed.js" --deposit=1000000ubld \
		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --yes -b block

price-feed-submit-core-eval: price-feed-install-contract-bundle price-feed-install-manifest-bundle price-feed-submit-proposal vote



# ====================================================     Auctioneer  =================================================

AUCTIONEER-SCRIPT = ${shell pwd}/src/proposals/auctioneer-script.js

AUCTIONEER-CONTRACT_REF_BUNDLE_ID = @cache/auctioneer/b1-a71e2df8c1d9c8eeadcf79bbbd3a25d84e6f10d1db0f5fce2bf705a625f6609f6a33ab8553f01565dd438cbfb4cd52be27b666d91900933908d2974cad32186b.json
AUCTIONEER-MANIFEST_REF_BUNDLE_ID = @cache/auctioneer/b1-5ea4e1abb079f04590abc84b09eadd0cb2fa9d4ae7997bbdae9b1e23860233ef0cf1d625453e4e7862c26fc54798a8e89582c37dac30feddd348c4468338bf19.json

auctioneer-bundle:
	rm -rf ${shell pwd}/cache/auctioneer/*
	${AGORIC} run ${AUCTIONEER-SCRIPT}

auctioneer-install-contract-bundle:
	${AGD} tx swingset install-bundle ${AUCTIONEER-CONTRACT_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

auctioneer-install-manifest-bundle:
	${AGD} tx swingset install-bundle ${AUCTIONEER-MANIFEST_REF_BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

auctioneer-submit-proposal:
	${AGD} tx gov submit-proposal swingset-core-eval startAuctioneer-permit.json startAuctioneer.js \
		--title="Enable auctioneer" --description="Evaluate startAuctioneer.js" --deposit=1000000ubld \
		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --yes -b block

auctioneer-submit-core-eval: auctioneer-install-contract-bundle auctioneer-install-manifest-bundle auctioneer-submit-proposal vote