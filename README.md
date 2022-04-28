# launchpad-contract

### airdrop 
```
solana airdrop -k ./service_wallet.json 2
```

### Testing
```
anchor test
```
#### Test Tokens 
- Test USDC
Decimals: 6 
AjKhs96eeQaif33HM9EkJSu8xzShbEW6VAGksBiP5qBH
- Test Token
Decimals: 9
84tDdtmHmvc6aTa4fA5ouh1mtwQd1a8idovb884ZDNq

#### Create pool
```
e.g) 1 Token price in USDC is 0.1, in SOL is 0.01 
ts-node ./scripts/tool.ts create-pool -e devnet -n pool2 --price_in_sol 10_000_000 --price_in_usdc 100_000 -t 84tDdtmHmvc6aTa4fA5ouh1mtwQd1a8idovb884ZDNq -k ./service_wallet.json
> result
Tx: 2FD6wLsU1NSPDoadQ8HNsjw2FZMv8cVq3C4Ev7T8ZE88MFCRtJGZM97HuPEP4nSAckRxFt3qA5mx2sf4pQ4pTxEv
Token Distributor: A5sNG3AtMHM2yaZUESz4tASSYNzuGWDKtn6R5BrnZas4
```

#### Approve token delegation
```
ts-node ./scripts/tool.ts approve -e devnet -t 84tDdtmHmvc6aTa4fA5ouh1mtwQd1a8idovb884ZDNq -d 2KxqXaZdJifiYtz69S3k29o2LqGANC7LatPzqYSx5EHs -a 100_000 -k ./service_wallet.json
```
