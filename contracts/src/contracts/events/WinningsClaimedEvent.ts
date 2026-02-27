import { u256 } from '@btc-vision/as-bignum/assembly';
import { Address, BytesWriter, NetEvent } from '@btc-vision/btc-runtime/runtime';

@final
export class WinningsClaimedEvent extends NetEvent {
    constructor(marketId: u256, user: Address, amount: u256) {
        // 32 (marketId) + 32 (user) + 32 (amount) = 96
        const data = new BytesWriter(96);
        data.writeU256(marketId);
        data.writeAddress(user);
        data.writeU256(amount);
        super('WinningsClaimed', data);
    }
}
