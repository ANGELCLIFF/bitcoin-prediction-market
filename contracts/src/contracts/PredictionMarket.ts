import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesWriter,
    Calldata,
    EMPTY_POINTER,
    encodeSelector,
    OP_NET,
    Revert,
    SafeMath,
    Selector,
    StoredMapU256,
    StoredU256,
} from '@btc-vision/btc-runtime/runtime';
import { BetPlacedEvent } from './events/BetPlacedEvent';
import { MarketCreatedEvent } from './events/MarketCreatedEvent';
import { MarketResolvedEvent } from './events/MarketResolvedEvent';
import { WinningsClaimedEvent } from './events/WinningsClaimedEvent';

// Asset identifiers (0 = BTC, 1 = ETH)
const ASSET_ETH: u32 = 1;

// Protocol fee constants
const DEFAULT_FEE_BPS: u256 = u256.fromU32(250);   // 2.5%
const FEE_DENOMINATOR: u256 = u256.fromU32(10000);

// OP20 cross-contract call selectors
const TRANSFER_FROM_SELECTOR: Selector = encodeSelector('transferFrom');
const TRANSFER_SELECTOR: Selector = encodeSelector('transfer');

// ── Module-level pointer allocation (must be module-level, not class fields) ──
const p_marketCount: u16    = Blockchain.nextPointer;
const p_admin: u16          = Blockchain.nextPointer;
const p_feeCollector: u16   = Blockchain.nextPointer;
const p_protocolFee: u16    = Blockchain.nextPointer;
const p_collateral: u16     = Blockchain.nextPointer;
const p_mktAsset: u16       = Blockchain.nextPointer;
const p_mktStrike: u16      = Blockchain.nextPointer;
const p_mktExpiry: u16      = Blockchain.nextPointer;
const p_mktYesPool: u16     = Blockchain.nextPointer;
const p_mktNoPool: u16      = Blockchain.nextPointer;
const p_mktResolved: u16    = Blockchain.nextPointer;
const p_mktOutcome: u16     = Blockchain.nextPointer;
const p_userYes: u16        = Blockchain.nextPointer;
const p_userNo: u16         = Blockchain.nextPointer;
const p_userClaimed: u16    = Blockchain.nextPointer;

export class PredictionMarket extends OP_NET {
    // ── Single-value storage ──
    private readonly marketCount: StoredU256;
    private readonly adminStored: StoredU256;
    private readonly feeCollectorStored: StoredU256;
    private readonly protocolFee: StoredU256;
    private readonly collateralToken: StoredU256;

    // ── Per-market data (key = marketId u256) ──
    private readonly mktAsset: StoredMapU256;
    private readonly mktStrike: StoredMapU256;
    private readonly mktExpiry: StoredMapU256;
    private readonly mktYesPool: StoredMapU256;
    private readonly mktNoPool: StoredMapU256;
    private readonly mktResolved: StoredMapU256;
    private readonly mktOutcome: StoredMapU256;

    // ── Per-user-per-market positions (key = sha256(marketId||user)) ──
    private readonly userYes: StoredMapU256;
    private readonly userNo: StoredMapU256;
    private readonly userClaimed: StoredMapU256;

    public constructor() {
        super();

        this.marketCount      = new StoredU256(p_marketCount,  EMPTY_POINTER);
        this.adminStored      = new StoredU256(p_admin,        EMPTY_POINTER);
        this.feeCollectorStored = new StoredU256(p_feeCollector, EMPTY_POINTER);
        this.protocolFee      = new StoredU256(p_protocolFee,  EMPTY_POINTER);
        this.collateralToken  = new StoredU256(p_collateral,   EMPTY_POINTER);

        this.mktAsset         = new StoredMapU256(p_mktAsset);
        this.mktStrike        = new StoredMapU256(p_mktStrike);
        this.mktExpiry        = new StoredMapU256(p_mktExpiry);
        this.mktYesPool       = new StoredMapU256(p_mktYesPool);
        this.mktNoPool        = new StoredMapU256(p_mktNoPool);
        this.mktResolved      = new StoredMapU256(p_mktResolved);
        this.mktOutcome       = new StoredMapU256(p_mktOutcome);

        this.userYes          = new StoredMapU256(p_userYes);
        this.userNo           = new StoredMapU256(p_userNo);
        this.userClaimed      = new StoredMapU256(p_userClaimed);
    }

    public override onDeployment(calldata: Calldata): void {
        const deployer = Blockchain.tx.sender;
        const deployerU256 = u256.fromUint8ArrayBE(deployer);
        this.adminStored.set(deployerU256);
        this.feeCollectorStored.set(deployerU256);
        this.protocolFee.set(DEFAULT_FEE_BPS);

        const token = calldata.readAddress();
        this.collateralToken.set(u256.fromUint8ArrayBE(token));
    }

    // ── createMarket(asset: u32, strikePrice: u256, expiryBlock: u64) → marketId: u256 ──
    @method(
        { name: 'asset', type: ABIDataTypes.UINT32 },
        { name: 'strikePrice', type: ABIDataTypes.UINT256 },
        { name: 'expiryBlock', type: ABIDataTypes.UINT64 },
    )
    @returns({ name: 'marketId', type: ABIDataTypes.UINT256 })
    private createMarket(calldata: Calldata): BytesWriter {
        this._requireAdmin();
        const asset = calldata.readU32();
        const strikePrice = calldata.readU256();
        const expiryBlock = calldata.readU64();

        if (asset > ASSET_ETH) throw new Revert('Invalid asset: 0=BTC 1=ETH');
        if (strikePrice == u256.Zero) throw new Revert('Strike price must be > 0');
        if (expiryBlock <= Blockchain.block.number) throw new Revert('Expiry must be in future');

        const marketId = this.marketCount.value;
        this.mktAsset.set(marketId, u256.fromU32(asset));
        this.mktStrike.set(marketId, strikePrice);
        this.mktExpiry.set(marketId, u256.fromU64(expiryBlock));
        this.mktYesPool.set(marketId, u256.Zero);
        this.mktNoPool.set(marketId, u256.Zero);
        this.mktResolved.set(marketId, u256.Zero);
        this.mktOutcome.set(marketId, u256.Zero);
        this.marketCount.set(SafeMath.add(marketId, u256.One));

        this.emitEvent(new MarketCreatedEvent(marketId, asset, strikePrice, expiryBlock));

        const res = new BytesWriter(32);
        res.writeU256(marketId);
        return res;
    }

    // ── placeBet(marketId: u256, isYes: bool, amount: u256) → bool ──
    @method(
        { name: 'marketId', type: ABIDataTypes.UINT256 },
        { name: 'isYes', type: ABIDataTypes.BOOL },
        { name: 'amount', type: ABIDataTypes.UINT256 },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    private placeBet(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const isYes = calldata.readBoolean();
        const amount = calldata.readU256();

        this._requireMarketExists(marketId);
        this._requireNotResolved(marketId);
        this._requireNotExpired(marketId);
        if (amount == u256.Zero) throw new Revert('Amount must be > 0');

        const sender = Blockchain.tx.sender;
        this._transferFrom(sender, Blockchain.contractAddress, amount);

        const posKey = this._positionKey(marketId, sender);
        if (isYes) {
            this.mktYesPool.set(marketId, SafeMath.add(this.mktYesPool.get(marketId), amount));
            this.userYes.set(posKey, SafeMath.add(this.userYes.get(posKey), amount));
        } else {
            this.mktNoPool.set(marketId, SafeMath.add(this.mktNoPool.get(marketId), amount));
            this.userNo.set(posKey, SafeMath.add(this.userNo.get(posKey), amount));
        }

        this.emitEvent(new BetPlacedEvent(marketId, sender, isYes, amount));

        const res = new BytesWriter(1);
        res.writeBoolean(true);
        return res;
    }

    // ── resolveMarket(marketId: u256, outcome: bool) → bool ──
    @method(
        { name: 'marketId', type: ABIDataTypes.UINT256 },
        { name: 'outcome', type: ABIDataTypes.BOOL },
    )
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    private resolveMarket(calldata: Calldata): BytesWriter {
        this._requireAdmin();
        const marketId = calldata.readU256();
        const outcome = calldata.readBoolean();

        this._requireMarketExists(marketId);
        this._requireNotResolved(marketId);

        this.mktResolved.set(marketId, u256.One);
        this.mktOutcome.set(marketId, outcome ? u256.One : u256.Zero);
        this.emitEvent(new MarketResolvedEvent(marketId, outcome));

        const res = new BytesWriter(1);
        res.writeBoolean(true);
        return res;
    }

    // ── claimWinnings(marketId: u256) → amountClaimed: u256 ──
    @method({ name: 'marketId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'amountClaimed', type: ABIDataTypes.UINT256 })
    private claimWinnings(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const sender = Blockchain.tx.sender;

        this._requireMarketExists(marketId);
        this._requireResolved(marketId);

        const posKey = this._positionKey(marketId, sender);
        if (this.userClaimed.get(posKey) != u256.Zero) throw new Revert('Already claimed');

        const outcomeYes = this.mktOutcome.get(marketId) != u256.Zero;
        const yesPool = this.mktYesPool.get(marketId);
        const noPool  = this.mktNoPool.get(marketId);

        let stake: u256;
        let winPool: u256;
        let losePool: u256;
        if (outcomeYes) {
            stake    = this.userYes.get(posKey);
            winPool  = yesPool;
            losePool = noPool;
        } else {
            stake    = this.userNo.get(posKey);
            winPool  = noPool;
            losePool = yesPool;
        }
        if (stake == u256.Zero) throw new Revert('No winning position');

        // Mark claimed BEFORE any external transfer (reentrancy protection)
        this.userClaimed.set(posKey, u256.One);

        let payout: u256;
        if (losePool == u256.Zero) {
            payout = stake;
        } else {
            const gross = SafeMath.div(SafeMath.mul(stake, losePool), winPool);
            const fee   = SafeMath.div(SafeMath.mul(gross, this.protocolFee.value), FEE_DENOMINATOR);
            payout      = SafeMath.add(stake, SafeMath.sub(gross, fee));
            if (fee != u256.Zero) {
                this._transfer(this._loadAddress(this.feeCollectorStored), fee);
            }
        }

        this._transfer(sender, payout);
        this.emitEvent(new WinningsClaimedEvent(marketId, sender, payout));

        const res = new BytesWriter(32);
        res.writeU256(payout);
        return res;
    }

    // ── getMarket(marketId) → (asset, strikePrice, expiryBlock, yesPool, noPool, resolved, outcome) ──
    @method({ name: 'marketId', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'asset', type: ABIDataTypes.UINT32 },
        { name: 'strikePrice', type: ABIDataTypes.UINT256 },
        { name: 'expiryBlock', type: ABIDataTypes.UINT64 },
        { name: 'yesPool', type: ABIDataTypes.UINT256 },
        { name: 'noPool', type: ABIDataTypes.UINT256 },
        { name: 'resolved', type: ABIDataTypes.BOOL },
        { name: 'outcome', type: ABIDataTypes.BOOL },
    )
    private getMarket(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        this._requireMarketExists(marketId);

        // 4 + 32 + 8 + 32 + 32 + 1 + 1 = 110
        const res = new BytesWriter(110);
        res.writeU32(u32(this.mktAsset.get(marketId).toU64()));
        res.writeU256(this.mktStrike.get(marketId));
        res.writeU64(this.mktExpiry.get(marketId).toU64());
        res.writeU256(this.mktYesPool.get(marketId));
        res.writeU256(this.mktNoPool.get(marketId));
        res.writeBoolean(this.mktResolved.get(marketId) != u256.Zero);
        res.writeBoolean(this.mktOutcome.get(marketId) != u256.Zero);
        return res;
    }

    // ── getUserPosition(marketId, user) → (yesShares, noShares, claimed) ──
    @method(
        { name: 'marketId', type: ABIDataTypes.UINT256 },
        { name: 'user', type: ABIDataTypes.ADDRESS },
    )
    @returns(
        { name: 'yesShares', type: ABIDataTypes.UINT256 },
        { name: 'noShares', type: ABIDataTypes.UINT256 },
        { name: 'claimed', type: ABIDataTypes.BOOL },
    )
    private getUserPosition(calldata: Calldata): BytesWriter {
        const marketId = calldata.readU256();
        const user = calldata.readAddress();
        this._requireMarketExists(marketId);

        const posKey = this._positionKey(marketId, user);
        // 32 + 32 + 1 = 65
        const res = new BytesWriter(65);
        res.writeU256(this.userYes.get(posKey));
        res.writeU256(this.userNo.get(posKey));
        res.writeBoolean(this.userClaimed.get(posKey) != u256.Zero);
        return res;
    }

    // ── getMarketCount() → u256 ──
    @method()
    @returns({ name: 'count', type: ABIDataTypes.UINT256 })
    private getMarketCount(_calldata: Calldata): BytesWriter {
        const res = new BytesWriter(32);
        res.writeU256(this.marketCount.value);
        return res;
    }

    // ── getCollateralToken() → address ──
    @method()
    @returns({ name: 'token', type: ABIDataTypes.ADDRESS })
    private getCollateralToken(_calldata: Calldata): BytesWriter {
        const res = new BytesWriter(32);
        res.writeAddress(this._loadAddress(this.collateralToken));
        return res;
    }

    // ── setAdmin(newAdmin: address) → bool ──
    @method({ name: 'newAdmin', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    private setAdmin(calldata: Calldata): BytesWriter {
        this._requireAdmin();
        this.adminStored.set(u256.fromUint8ArrayBE(calldata.readAddress()));
        const res = new BytesWriter(1);
        res.writeBoolean(true);
        return res;
    }

    // ── setFeeCollector(newCollector: address) → bool ──
    @method({ name: 'newCollector', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    private setFeeCollector(calldata: Calldata): BytesWriter {
        this._requireAdmin();
        this.feeCollectorStored.set(u256.fromUint8ArrayBE(calldata.readAddress()));
        const res = new BytesWriter(1);
        res.writeBoolean(true);
        return res;
    }

    // ── setProtocolFee(feeBps: u256) → bool — max 10% ──
    @method({ name: 'feeBps', type: ABIDataTypes.UINT256 })
    @returns({ name: 'success', type: ABIDataTypes.BOOL })
    private setProtocolFee(calldata: Calldata): BytesWriter {
        this._requireAdmin();
        const feeBps = calldata.readU256();
        if (feeBps > u256.fromU32(1000)) throw new Revert('Fee cannot exceed 10%');
        this.protocolFee.set(feeBps);
        const res = new BytesWriter(1);
        res.writeBoolean(true);
        return res;
    }

    // ──────────────────────────────────────────────────────
    //  Private helpers
    // ──────────────────────────────────────────────────────

    private _requireAdmin(): void {
        if (u256.fromUint8ArrayBE(Blockchain.tx.sender) != this.adminStored.value) {
            throw new Revert('Not admin');
        }
    }

    private _requireMarketExists(marketId: u256): void {
        if (marketId >= this.marketCount.value) throw new Revert('Market does not exist');
    }

    private _requireNotResolved(marketId: u256): void {
        if (this.mktResolved.get(marketId) != u256.Zero) throw new Revert('Already resolved');
    }

    private _requireResolved(marketId: u256): void {
        if (this.mktResolved.get(marketId) == u256.Zero) throw new Revert('Not resolved yet');
    }

    private _requireNotExpired(marketId: u256): void {
        if (Blockchain.block.number >= this.mktExpiry.get(marketId).toU64()) {
            throw new Revert('Market expired');
        }
    }

    // sha256(marketId 32 bytes || user 32 bytes) → composite position key
    private _positionKey(marketId: u256, user: Address): u256 {
        const combined = new Uint8Array(64);
        const mktBytes = marketId.toUint8Array(true); // big-endian 32 bytes
        memory.copy(combined.dataStart, mktBytes.dataStart, 32);
        memory.copy(combined.dataStart + 32, user.dataStart, 32);
        return u256.fromUint8ArrayBE(Blockchain.sha256(combined));
    }

    // Reconstruct Address from stored u256 big-endian bytes
    private _loadAddress(stored: StoredU256): Address {
        return Address.fromUint8Array(stored.value.toUint8Array(true));
    }

    // Cross-contract: transferFrom(from, to, amount) on collateral OP20
    private _transferFrom(from: Address, to: Address, amount: u256): void {
        const token = this._loadAddress(this.collateralToken);
        // 4 + 32 + 32 + 32 = 100
        const cd = new BytesWriter(100);
        cd.writeSelector(TRANSFER_FROM_SELECTOR);
        cd.writeAddress(from);
        cd.writeAddress(to);
        cd.writeU256(amount);
        const result = Blockchain.call(token, cd, false);
        if (!result.success) throw new Revert('transferFrom failed: check allowance');
        if (!result.data.readBoolean()) throw new Revert('transferFrom returned false');
    }

    // Cross-contract: transfer(to, amount) on collateral OP20
    private _transfer(to: Address, amount: u256): void {
        const token = this._loadAddress(this.collateralToken);
        // 4 + 32 + 32 = 68
        const cd = new BytesWriter(68);
        cd.writeSelector(TRANSFER_SELECTOR);
        cd.writeAddress(to);
        cd.writeU256(amount);
        const result = Blockchain.call(token, cd, false);
        if (!result.success) throw new Revert('transfer failed');
        if (!result.data.readBoolean()) throw new Revert('transfer returned false');
    }
}
