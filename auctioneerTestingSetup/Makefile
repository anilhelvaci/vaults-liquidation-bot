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

MANUAL-TIMER-CONTRACT_REF_BUNDLE_ID = @cache/manual-timer/b1-64b95b1a011bcfef38c4ccc0dc50b5c831e272d5244f1257ce9c56537a467a032f3754caebe2272a5999406d333e11ef54eb8189035c78ed6e965a81b56663e6.json
MANUAL-TIMER-MANIFEST_REF_BUNDLE_ID = @cache/manual-timer/b1-dbe02098bd20f6ed2e5160124a888741b36521ab3cc4d32cf7cbe75bb33d9dcf0fb8f2ace2d5e60f34dbf74029b86fd0520fb1b41801e6dc9949ad32c3326d58.json

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

ASSET-FAUCET-CONTRACT_REF_BUNDLE_ID = @cache/asset-faucet/b1-1e841e43415f239d7cbe53850ffc32e8766ed5760657c289f9debc23445e0a32ed82d4e33a9ad53a0fbdf7ae21b4f0c5b06337a50f20422289f8531af186bba7.json
ASSET-FAUCET-MANIFEST_REF_BUNDLE_ID = @cache/asset-faucet/b1-bc90824909ce251e1c1647c8348fcac80bc49fc240af2c116ea0a6f4e289090f650812c1fa4c770bc5e10e6ec5926efebed9ec95d302620f51aa5e9443f9c694.json

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


# ====================================================     Oracle fakeAtom  =================================================

ASSET-FAUCET-SCRIPT = ${shell pwd}/src/proposals/assetFaucet-script.js

BUNDLE_ID = @cache/price-feed/b1-80e6fe68b299c82c2d26802c312bc37966a559f7b28f87d058887a79a9db48ad97da2240e71e3f98986071da8fc3c5d02358bec577b17a89cee2b1cb3cd23958.json


oracle-install-contract-bundle:
	${AGD} tx swingset install-bundle ${BUNDLE_ID} \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --gas=$(GAS) --yes -b block

oracle-submit-proposal:
	${AGD} tx gov submit-proposal swingset-core-eval add-stATOM-oracles-permit.json add-stATOM-oracles.js \
		--title="Enable oracle" --description="Evaluate add-stATOM-oracles.js" --deposit=1000000ubld \
		--gas=auto --gas-adjustment=$(GAS_ADJUSTMENT) \
		--from=${LOCAL_WALLET} --home=${HOME}  --chain-id=${LOCAL_CHAIN_ID} --keyring-backend=test --yes -b block

oracle-submit-core-eval: oracle-install-contract-bundle oracle-submit-proposal vote


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