1. create pools
2. buy tokens
3. feed pools
4. swap
5. fix price - swap amount to make price in pool like in UniV3



```
npx hardhat run scripts/qs-arb-setup/01_create-pools.js --network localhost
# copy pool addreses to 00, 03
npx hardhat run scripts/qs-arb-setup/02_buy-tokens.js --network localhost
npx hardhat run scripts/qs-arb-setup/03_pool-feeding.js --network localhost
npx hardhat run scripts/qs-arb-setup/04_test-swap.js --network localhost
npx hardhat run scripts/qs-arb-setup/05_fix-price.js --network localhost
```

get info script run command. Should be updated with crated QS pool addresses
```
npx hardhat run scripts/qs-arb-setup/00_get-pool-info.js --network localhost
```
