
# Pools 

This repository has scripts for deploy,testing different pools 


## How to test?

1) Run node 

`npx hardhat node --no-deploy`

2) Buy needed tokens (DAI,USDC,USDT)

`npx hardhat run scripts/buy-need-amounts.js --network localhost`

3) Add role EXCHANGER for USDPlus to wallet address

` npx hardhat run scripts/set-usd-plus-admin.js --network localhost`

4) Create Balancer Stable Pool

`npx hardhat run scripts/balancer-stable-pool.js --network localhost `

5) Run tests for Stable Pool

`npx hardhat run scripts/balancer-stable-pool-test.js --network localhost `

> Uncomment needed lines inside file 
