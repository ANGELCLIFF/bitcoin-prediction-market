import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

@final
export class MarketResolvedEvent extends NetEvent {
    constructor(marketId: u256, outcome: bool) {
        // 32 (marketId) + 1 (outcome) = 33
        const data = new BytesWriter(33);
        data.writeU256(marketId);
        data.writeBoolean(outcome);
        super('MarketResolved', data);
    }
}
