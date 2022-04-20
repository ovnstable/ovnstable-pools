1. create pools
2. buy tokens
3. feed pools
4. set targets
5. send money to arb bot
6. start bot
7. test swaps - here need to change params inside script


```
# start node in rebalancer and copy to bot rebalancers adresses to bot config
npx hardhat run ./scripts/balancer-arb-setup/01_create-pools.js --network localhost
# here copy pool adresses to 03, 04, 07 and bot config
npx hardhat run ./scripts/balancer-arb-setup/02_buy-tokens.js --network localhost
npx hardhat run ./scripts/balancer-arb-setup/03_pool-feeding.js --network localhost
npx hardhat run ./scripts/balancer-arb-setup/04_set-targets.js --network localhost
npx hardhat run ./scripts/balancer-arb-setup/05_send-tokens-to-arb-bot.js --network localhost
# run bot
npx hardhat run ./scripts/balancer-arb-setup/07_test-swap.js --network localhost
```
