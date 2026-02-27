import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

@final
export class MarketCreatedEvent extends NetEvent {
    constructor(marketId: u256, asset: u32, strikePrice: u256, expiryBlock: u64) {
        // 32 (marketId) + 4 (asset) + 32 (strikePrice) + 8 (expiryBlock) = 76
        const data = new BytesWriter(76);
        data.writeU256(marketId);
        data.writeU32(asset);
        data.writeU256(strikePrice);
        data.writeU64(expiryBlock);
        super('MarketCreated', data);
    }
}
