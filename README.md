# Script for mass sending CLO coins by the list in CSV
# (CLI version)

UP to 500 txs per block.

## Running locally

Install the app's dependencies:

```bash
npm install
```

Set up your local environment variables by copying the example into your own `.env` file:

```bash
cp .env.sample .env
```

Your `.env` now contains the following environment variables:

- `IN_FILE` (placeholder) - CSV file (delimiter = ;) with list of address & values to send
- `OUT_FILE` (placeholder) - CSV file for results
- `ADDRESS_COL` (placeholder) - Index of column holding address
- `VALUE_COL` (placeholder) - Index of column holding value
- `THRESHOLD` (placeholder) - Values below this THRESHOLD will be ignored
- `PRIVATE_KEY` (placeholder) - Key of source wallet
- `BATCH_SIZE` (placeholder) - Number of txs in one batch 
- `BATCH_DELAY` (placeholder) - Delay between batch of txs in seconds 
- `GAS_PRICE` (placeholder) - Manually provide `gasPrice` in gwei 
- `RPC` (placeholder) - RPC node address
- `START_LINE` (placeholder) - Index of line in CSV to start from (e.g. skip previous lines) (default = 0)

Start app:

```bash
npm start
```

Results will be in OUT_FILE.

## Contacts

[LinkedIn](https://www.linkedin.com/in/aleksandr-s-terekhov/)
