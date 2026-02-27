import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

@final
export class BetPlacedEvent extends NetEvent {
    constructor(marketId: u256, user: Address, isYes: bool, amount: u256) {
        // 32 (marketId) + 32 (user) + 1 (isYes) + 32 (amount) = 97
        const data = new BytesWriter(97);
        data.writeU256(marketId);
        data.writeAddress(user);
        data.writeBoolean(isYes);
        data.writeU256(amount);
        super('BetPlaced', data);
    }
}
