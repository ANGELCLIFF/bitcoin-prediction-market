# PredictBTC — Bitcoin-Native Prediction Markets

Decentralized prediction markets for **BTC** and **ETH** price on Bitcoin Layer 1 via [OPNet](https://opnet.org).

No Polymarket. No Ethereum. Pure Bitcoin.

---

## Architecture

```
bitcoin-prediction-market/
├── contracts/          # AssemblyScript smart contract (OPNet)
│   └── src/contracts/
│       ├── PredictionMarket.ts    # Core contract
│       ├── index.ts               # Entry point
│       └── events/                # Event definitions
└── frontend/           # React + Vite dApp
    └── src/
        ├── abi/        # ABI definition for contract interaction
        ├── components/ # UI components
        ├── hooks/      # usePredictionMarket hook
        └── pages/      # App pages
```

## How It Works

1. **Admin creates a market** — e.g., "Will BTC reach $150,000 before block 900000?"
2. **Users bet YES or NO** by staking an OP20 collateral token (e.g., WBTC)
3. **Market resolves** when the admin sets the outcome (future: oracle-based)
4. **Winners claim** their proportional share of the losing pool, minus a 2.5% protocol fee

### Payout Formula

```
gross_winnings = (user_stake / winner_pool) * loser_pool
fee            = gross_winnings * 2.5%
total_payout   = user_stake + gross_winnings - fee
```

## Contract Methods

| Method | Access | Description |
|---|---|---|
| `createMarket(asset, strikePrice, expiryBlock)` | Admin | Create a new BTC/ETH price market |
| `placeBet(marketId, isYes, amount)` | Anyone | Stake tokens on YES or NO |
| `resolveMarket(marketId, outcome)` | Admin | Set final outcome |
| `claimWinnings(marketId)` | Winners | Claim payout |
| `getMarket(marketId)` | View | Get market details |
| `getUserPosition(marketId, user)` | View | Get user's position |

## Deployment

### 1. Deploy the Contract

```bash
cd contracts
npm install
npm run build
# Deploy via opnet-cli with collateral token address as constructor arg
opnet-cli deploy --network testnet --contract dist/PredictionMarket.wasm \
  --args "<collateral_token_address>"
```

### 2. Configure the Frontend

```bash
cd frontend
cp .env.example .env
# Fill in your deployed contract address, collateral token, and admin address
npm install
npm run dev
```

### 3. Approve Collateral Token

Before placing bets, users must approve the PredictionMarket contract to spend their collateral tokens:

```typescript
// Via opnet SDK
await collateralToken.approve(PREDICTION_MARKET_ADDRESS, amount);
```

## Assets

| ID | Asset | Icon |
|---|---|---|
| 0 | Bitcoin | ₿ |
| 1 | Ethereum | Ξ |

## Security

- All arithmetic uses `SafeMath` (overflow/underflow protected)
- Reentrancy protection via state-before-transfer (checks-effects-interactions)
- Admin-only market creation and resolution
- Fee capped at 10% (1000 bps)
- Markets expire at a fixed block number preventing indefinite open positions

## Network

Targets **OPNet Testnet** (Signet fork): `https://testnet.opnet.org`

Use `networks.opnetTestnet` from `@btc-vision/bitcoin` — **NOT** `networks.testnet`.
