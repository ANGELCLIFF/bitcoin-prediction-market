import { useState } from 'react';
import type { MarketData } from '../hooks/usePredictionMarket';
import { ASSET_ICONS, ASSET_LABELS } from '../abi/PredictionMarketABI';
import { BetModal } from './BetModal';

interface MarketCardProps {
    market: MarketData;
    userAddress: string | null;
    isAdmin: boolean;
    onBet: (marketId: bigint, isYes: boolean, amount: bigint) => Promise<void>;
    onClaim: (marketId: bigint) => Promise<void>;
    onResolve: (marketId: bigint, outcome: boolean) => Promise<void>;
    checkAllowance: (userAddress: string, amount: bigint) => Promise<boolean>;
    approveToken: (amount: bigint, userAddress: string) => Promise<string | null>;
    userPosition?: { yesShares: bigint; noShares: bigint; claimed: boolean } | null;
}

// Format a u256 price (8 decimal places) to a USD string
function formatPrice(raw: bigint): string {
    const whole = raw / 100_000_000n;
    const frac = raw % 100_000_000n;
    const fracStr = frac.toString().padStart(8, '0').replace(/0+$/, '') || '00';
    return `$${whole.toLocaleString()}.${fracStr.slice(0, 2)}`;
}

// Format token amount (18 decimals)
function formatAmount(raw: bigint): string {
    if (raw === 0n) return '0';
    const whole = raw / 10n ** 18n;
    return whole.toLocaleString();
}

function getOdds(yesPool: bigint, noPool: bigint): { yes: number; no: number } {
    const total = yesPool + noPool;
    if (total === 0n) return { yes: 50, no: 50 };
    const yes = Number((yesPool * 10000n) / total) / 100;
    return { yes, no: Math.round((100 - yes) * 100) / 100 };
}

export function MarketCard({ market, userAddress, isAdmin, onBet, onClaim, onResolve, checkAllowance, approveToken, userPosition }: MarketCardProps) {
    const [betModalOpen, setBetModalOpen] = useState(false);
    const [betSide, setBetSide] = useState<'yes' | 'no'>('yes');
    const [claimLoading, setClaimLoading] = useState(false);
    const [resolveConfirm, setResolveConfirm] = useState<'yes' | 'no' | null>(null);
    const [resolveLoading, setResolveLoading] = useState(false);

    const odds = getOdds(market.yesPool, market.noPool);
    const totalPool = market.yesPool + market.noPool;
    const assetLabel = ASSET_LABELS[market.asset] ?? 'Unknown';
    const assetIcon = ASSET_ICONS[market.asset] ?? '?';

    function openBet(side: 'yes' | 'no') {
        setBetSide(side);
        setBetModalOpen(true);
    }

    async function handleClaim() {
        setClaimLoading(true);
        try {
            await onClaim(market.id);
        } finally {
            setClaimLoading(false);
        }
    }

    async function handleResolve(outcome: boolean) {
        setResolveLoading(true);
        try {
            await onResolve(market.id, outcome);
        } finally {
            setResolveLoading(false);
            setResolveConfirm(null);
        }
    }

    const hasWinningPosition = userPosition && market.resolved && (
        (market.outcome && userPosition.yesShares > 0n) ||
        (!market.outcome && userPosition.noShares > 0n)
    );

    const canClaim = hasWinningPosition && !userPosition?.claimed;

    return (
        <>
            <div style={styles.card}>
                {/* Header */}
                <div style={styles.cardHeader}>
                    <div style={styles.assetBadge}>
                        <span style={styles.assetIcon}>{assetIcon}</span>
                        <span style={styles.assetLabel}>{assetLabel}</span>
                    </div>
                    {market.resolved ? (
                        <span style={{
                            ...styles.statusBadge,
                            background: market.outcome ? '#0d2b0d' : '#2b0d0d',
                            color: market.outcome ? '#4caf50' : '#f44336',
                            border: `1px solid ${market.outcome ? '#1a4a1a' : '#4a1a1a'}`,
                        }}>
                            {market.outcome ? '✓ YES Won' : '✗ NO Won'}
                        </span>
                    ) : (
                        <span style={{ ...styles.statusBadge, background: '#1a1a0d', color: '#f7931a', border: '1px solid #3a2a0a' }}>
                            Live
                        </span>
                    )}
                </div>

                {/* Question */}
                <div style={styles.question}>
                    Will {assetLabel} reach {formatPrice(market.strikePrice)}?
                </div>

                {/* Pool bar */}
                <div style={styles.poolSection}>
                    <div style={styles.poolLabels}>
                        <span style={styles.yesLabel}>YES {odds.yes.toFixed(1)}%</span>
                        <span style={styles.noLabel}>NO {odds.no.toFixed(1)}%</span>
                    </div>
                    <div style={styles.bar}>
                        <div style={{ ...styles.yesBar, width: `${odds.yes}%` }} />
                        <div style={{ ...styles.noBar, width: `${odds.no}%` }} />
                    </div>
                    <div style={styles.poolAmounts}>
                        <span style={styles.yesAmount}>{formatAmount(market.yesPool)} tokens</span>
                        <span style={styles.noAmount}>{formatAmount(market.noPool)} tokens</span>
                    </div>
                </div>

                {/* Total pool */}
                <div style={styles.totalPool}>
                    <span style={styles.totalLabel}>Total Pool</span>
                    <span style={styles.totalValue}>{formatAmount(totalPool)} tokens</span>
                </div>

                {/* Expiry */}
                <div style={styles.expiryRow}>
                    <span style={styles.expiryLabel}>Expires at block</span>
                    <span style={styles.expiryValue}>{market.expiryBlock.toLocaleString()}</span>
                </div>

                {/* User position */}
                {userPosition && (userPosition.yesShares > 0n || userPosition.noShares > 0n) && (
                    <div style={styles.positionBox}>
                        <span style={styles.positionTitle}>Your Position</span>
                        {userPosition.yesShares > 0n && (
                            <span style={styles.positionYes}>YES: {formatAmount(userPosition.yesShares)}</span>
                        )}
                        {userPosition.noShares > 0n && (
                            <span style={styles.positionNo}>NO: {formatAmount(userPosition.noShares)}</span>
                        )}
                    </div>
                )}

                {/* Admin resolve controls */}
                {isAdmin && !market.resolved && (
                    <div style={styles.resolveSection}>
                        <span style={styles.resolveLabel}>Admin: Resolve Market</span>
                        {resolveConfirm === null ? (
                            <div style={styles.resolveRow}>
                                <button style={styles.resolveYesBtn} onClick={() => setResolveConfirm('yes')}>
                                    Resolve YES
                                </button>
                                <button style={styles.resolveNoBtn} onClick={() => setResolveConfirm('no')}>
                                    Resolve NO
                                </button>
                            </div>
                        ) : (
                            <div style={styles.resolveConfirmRow}>
                                <span style={styles.resolveConfirmText}>
                                    Confirm resolve as{' '}
                                    <strong style={{ color: resolveConfirm === 'yes' ? '#4caf50' : '#f44336' }}>
                                        {resolveConfirm.toUpperCase()}
                                    </strong>
                                    ? This cannot be undone.
                                </span>
                                <div style={styles.resolveRow}>
                                    <button
                                        style={styles.resolveConfirmBtn}
                                        onClick={() => handleResolve(resolveConfirm === 'yes')}
                                        disabled={resolveLoading}
                                    >
                                        {resolveLoading ? 'Sending…' : 'Confirm'}
                                    </button>
                                    <button
                                        style={styles.resolveCancelBtn}
                                        onClick={() => setResolveConfirm(null)}
                                        disabled={resolveLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                {!market.resolved && userAddress ? (
                    <div style={styles.actions}>
                        <button style={styles.yesBtn} onClick={() => openBet('yes')}>
                            Bet YES
                        </button>
                        <button style={styles.noBtn} onClick={() => openBet('no')}>
                            Bet NO
                        </button>
                    </div>
                ) : canClaim ? (
                    <button
                        style={styles.claimBtn}
                        onClick={handleClaim}
                        disabled={claimLoading}
                    >
                        {claimLoading ? 'Claiming…' : '🎉 Claim Winnings'}
                    </button>
                ) : market.resolved && userPosition?.claimed ? (
                    <div style={styles.claimedBadge}>✓ Winnings Claimed</div>
                ) : !userAddress && !market.resolved ? (
                    <div style={styles.connectPrompt}>Connect wallet to bet</div>
                ) : null}
            </div>

            {betModalOpen && userAddress && (
                <BetModal
                    market={market}
                    side={betSide}
                    userAddress={userAddress}
                    onClose={() => setBetModalOpen(false)}
                    onConfirm={async (amount) => {
                        await onBet(market.id, betSide === 'yes', amount);
                        setBetModalOpen(false);
                    }}
                    checkAllowance={checkAllowance}
                    approveToken={approveToken}
                />
            )}
        </>
    );
}

const styles: Record<string, React.CSSProperties> = {
    card: {
        background: '#111',
        border: '1px solid #1e1e1e',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'border-color 0.2s',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    assetBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    assetIcon: {
        fontSize: 20,
    },
    assetLabel: {
        fontSize: 14,
        fontWeight: 700,
        color: '#f7931a',
        letterSpacing: '0.5px',
    },
    statusBadge: {
        padding: '3px 10px',
        borderRadius: 100,
        fontSize: 12,
        fontWeight: 600,
    },
    question: {
        fontSize: 18,
        fontWeight: 600,
        color: '#fff',
        lineHeight: 1.4,
    },
    poolSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    poolLabels: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
        fontWeight: 600,
    },
    yesLabel: { color: '#4caf50' },
    noLabel: { color: '#f44336' },
    bar: {
        height: 8,
        borderRadius: 4,
        background: '#222',
        display: 'flex',
        overflow: 'hidden',
    },
    yesBar: {
        height: '100%',
        background: '#4caf50',
        transition: 'width 0.5s ease',
    },
    noBar: {
        height: '100%',
        background: '#f44336',
        flex: 1,
    },
    poolAmounts: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: '#555',
    },
    yesAmount: { color: '#2a6e2a' },
    noAmount: { color: '#6e2a2a' },
    totalPool: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: '#0d0d0d',
        borderRadius: 8,
        border: '1px solid #1a1a1a',
    },
    totalLabel: { fontSize: 13, color: '#555' },
    totalValue: { fontSize: 13, fontWeight: 600, color: '#aaa' },
    expiryRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: '#444',
    },
    expiryLabel: {},
    expiryValue: { fontFamily: 'monospace' },
    positionBox: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: '#0a1a0a',
        border: '1px solid #1a3a1a',
        borderRadius: 8,
        fontSize: 13,
    },
    positionTitle: { color: '#555', marginRight: 4 },
    positionYes: { color: '#4caf50', fontWeight: 600 },
    positionNo: { color: '#f44336', fontWeight: 600 },
    actions: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginTop: 4,
    },
    yesBtn: {
        background: 'linear-gradient(135deg, #1a4a1a, #2a6e2a)',
        border: '1px solid #2a6e2a',
        color: '#4caf50',
        padding: '11px 0',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
    },
    noBtn: {
        background: 'linear-gradient(135deg, #4a1a1a, #6e2a2a)',
        border: '1px solid #6e2a2a',
        color: '#f44336',
        padding: '11px 0',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
    },
    claimBtn: {
        background: 'linear-gradient(135deg, #f7931a, #e07b00)',
        border: 'none',
        color: '#000',
        padding: '12px 0',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
        width: '100%',
    },
    claimedBadge: {
        textAlign: 'center' as const,
        color: '#4caf50',
        fontSize: 13,
        padding: '10px',
    },
    connectPrompt: {
        textAlign: 'center' as const,
        color: '#444',
        fontSize: 13,
        padding: '10px',
    },
    resolveSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 14px',
        background: '#0d0d18',
        border: '1px solid #2a2a4a',
        borderRadius: 10,
    },
    resolveLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: '#555',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    resolveRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
    },
    resolveYesBtn: {
        background: 'transparent',
        border: '1px solid #2a6e2a',
        color: '#4caf50',
        padding: '8px 0',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
    },
    resolveNoBtn: {
        background: 'transparent',
        border: '1px solid #6e2a2a',
        color: '#f44336',
        padding: '8px 0',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
    },
    resolveConfirmRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    resolveConfirmText: {
        fontSize: 12,
        color: '#888',
        lineHeight: 1.5,
    },
    resolveConfirmBtn: {
        background: 'linear-gradient(135deg, #1a1a3a, #2a2a5a)',
        border: '1px solid #4a4aaa',
        color: '#aaaaff',
        padding: '8px 0',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 700,
    },
    resolveCancelBtn: {
        background: 'transparent',
        border: '1px solid #2a2a2a',
        color: '#555',
        padding: '8px 0',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
    },
};
