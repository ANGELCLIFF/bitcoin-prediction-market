import { useState } from 'react';
import type { MarketData } from '../hooks/usePredictionMarket';
import { ASSET_LABELS } from '../abi/PredictionMarketABI';

interface BetModalProps {
    market: MarketData;
    side: 'yes' | 'no';
    userAddress: string;
    onClose: () => void;
    onConfirm: (amount: bigint) => Promise<void>;
    checkAllowance: (userAddress: string, amount: bigint) => Promise<boolean>;
    approveToken: (amount: bigint, userAddress: string) => Promise<string | null>;
}

const TOKEN_DECIMALS = 10n ** 18n;

type Step = 'input' | 'approve' | 'bet';

export function BetModal({ market, side, userAddress, onClose, onConfirm, checkAllowance, approveToken }: BetModalProps) {
    const [amountStr, setAmountStr] = useState('');
    const [step, setStep] = useState<Step>('input');
    const [loading, setLoading] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [approvalHash, setApprovalHash] = useState<string | null>(null);

    const assetLabel = ASSET_LABELS[market.asset] ?? 'Unknown';
    const isYes = side === 'yes';

    const parsedAmount = (): bigint | null => {
        const parsed = parseFloat(amountStr);
        if (isNaN(parsed) || parsed <= 0) return null;
        return BigInt(Math.floor(parsed * 1e6)) * (TOKEN_DECIMALS / 1_000_000n);
    };

    async function handleContinue() {
        const amount = parsedAmount();
        if (!amount) { setTxError('Enter a valid amount'); return; }

        setLoading(true);
        setTxError(null);
        try {
            const sufficient = await checkAllowance(userAddress, amount);
            if (sufficient) {
                setStep('bet');
            } else {
                setStep('approve');
            }
        } catch (err) {
            setTxError(err instanceof Error ? err.message : 'Failed to check allowance');
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove() {
        const amount = parsedAmount();
        if (!amount) return;

        setLoading(true);
        setTxError(null);
        try {
            const hash = await approveToken(amount, userAddress);
            setApprovalHash(hash);
            setStep('bet');
        } catch (err) {
            setTxError(err instanceof Error ? err.message : 'Approval failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleBet() {
        const amount = parsedAmount();
        if (!amount) return;

        setLoading(true);
        setTxError(null);
        try {
            await onConfirm(amount);
        } catch (err) {
            setTxError(err instanceof Error ? err.message : 'Transaction failed');
            setLoading(false);
        }
    }

    const accentColor = isYes ? '#4caf50' : '#f44336';
    const stepLabels: Record<Step, string> = {
        input: '1 of 2 — Enter amount',
        approve: '1 of 2 — Approve tokens',
        bet: '2 of 2 — Place bet',
    };

    return (
        <div style={styles.backdrop} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.modalHeader}>
                    <div style={styles.modalTitleGroup}>
                        <span style={styles.modalTitle}>
                            Place {isYes ? 'YES' : 'NO'} Bet
                        </span>
                        <span style={styles.stepIndicator}>{stepLabels[step]}</span>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* Market info */}
                <div style={styles.marketInfo}>
                    <span style={styles.marketQuestion}>
                        Will {assetLabel} reach ${formatStrike(market.strikePrice)}?
                    </span>
                    <span style={{
                        ...styles.sidePill,
                        background: isYes ? '#0d2b0d' : '#2b0d0d',
                        color: accentColor,
                        border: `1px solid ${isYes ? '#1a4a1a' : '#4a1a1a'}`,
                    }}>
                        {isYes ? 'YES — Price will reach target' : 'NO — Price will fall short'}
                    </span>
                </div>

                {/* Step: input */}
                {step === 'input' && (
                    <div style={styles.inputSection}>
                        <label style={styles.inputLabel}>Bet Amount</label>
                        <div style={styles.inputRow}>
                            <input
                                type="number"
                                value={amountStr}
                                onChange={(e) => { setAmountStr(e.target.value); setTxError(null); }}
                                placeholder="0.00"
                                style={styles.input}
                                min="0"
                                step="0.01"
                                autoFocus
                            />
                            <span style={styles.inputSuffix}>PRED</span>
                        </div>
                    </div>
                )}

                {/* Step: approve */}
                {step === 'approve' && (
                    <div style={styles.stepBox}>
                        <span style={styles.stepIcon}>🔓</span>
                        <span style={styles.stepTitle}>Token Approval Required</span>
                        <span style={styles.stepDesc}>
                            You need to approve the PredictionMarket contract to spend{' '}
                            <strong style={{ color: '#fff' }}>{amountStr} PRED</strong> on your behalf.
                            This is a one-time approval per bet amount.
                        </span>
                    </div>
                )}

                {/* Step: bet */}
                {step === 'bet' && (
                    <div style={styles.stepBox}>
                        <span style={styles.stepIcon}>✓</span>
                        <span style={styles.stepTitle} style={{ color: '#4caf50' }}>Approval confirmed</span>
                        {approvalHash && (
                            <span style={styles.stepDesc}>
                                Approval TX: <code style={styles.hash}>{approvalHash.slice(0, 20)}…</code>
                            </span>
                        )}
                        <span style={styles.stepDesc}>
                            Ready to place your <strong style={{ color: accentColor }}>{isYes ? 'YES' : 'NO'}</strong> bet of{' '}
                            <strong style={{ color: '#fff' }}>{amountStr} PRED</strong>.
                        </span>
                    </div>
                )}

                {txError && <div style={styles.errorBox}>{txError}</div>}

                {/* Actions */}
                <div style={styles.modalActions}>
                    <button style={styles.cancelBtn} onClick={onClose} disabled={loading}>
                        Cancel
                    </button>

                    {step === 'input' && (
                        <button
                            style={styles.actionBtn}
                            onClick={handleContinue}
                            disabled={loading || !amountStr}
                        >
                            {loading ? 'Checking…' : 'Continue →'}
                        </button>
                    )}

                    {step === 'approve' && (
                        <button
                            style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #1a2a4a, #2a4a7a)', color: '#6ab0ff' }}
                            onClick={handleApprove}
                            disabled={loading}
                        >
                            {loading ? 'Approving…' : 'Approve PRED'}
                        </button>
                    )}

                    {step === 'bet' && (
                        <button
                            style={{
                                ...styles.actionBtn,
                                background: isYes
                                    ? 'linear-gradient(135deg, #1a4a1a, #2a6e2a)'
                                    : 'linear-gradient(135deg, #4a1a1a, #6e2a2a)',
                                color: accentColor,
                            }}
                            onClick={handleBet}
                            disabled={loading}
                        >
                            {loading ? 'Sending…' : `Confirm ${isYes ? 'YES' : 'NO'} Bet`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function formatStrike(raw: bigint): string {
    const whole = raw / 100_000_000n;
    return whole.toLocaleString();
}

const styles: Record<string, React.CSSProperties> = {
    backdrop: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        background: '#111',
        border: '1px solid #222',
        borderRadius: 16,
        padding: 28,
        width: '100%',
        maxWidth: 460,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    modalTitleGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 700,
        color: '#fff',
    },
    stepIndicator: {
        fontSize: 11,
        color: '#555',
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: '#555',
        fontSize: 18,
        cursor: 'pointer',
    },
    marketInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    marketQuestion: {
        fontSize: 15,
        color: '#ccc',
        lineHeight: 1.4,
    },
    sidePill: {
        display: 'inline-block',
        padding: '5px 12px',
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 600,
        alignSelf: 'flex-start',
    },
    inputSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    inputLabel: {
        fontSize: 13,
        color: '#888',
        fontWeight: 500,
    },
    inputRow: {
        display: 'flex',
        alignItems: 'center',
        background: '#0d0d0d',
        border: '1px solid #2a2a2a',
        borderRadius: 10,
        overflow: 'hidden',
    },
    input: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        color: '#fff',
        padding: '12px 16px',
        fontSize: 16,
        outline: 'none',
    },
    inputSuffix: {
        padding: '0 14px',
        color: '#555',
        fontSize: 13,
        fontWeight: 600,
        borderLeft: '1px solid #222',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
    },
    stepBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '16px',
        background: '#0d0d0d',
        border: '1px solid #1e1e1e',
        borderRadius: 12,
    },
    stepIcon: {
        fontSize: 22,
    },
    stepTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: '#fff',
    },
    stepDesc: {
        fontSize: 13,
        color: '#888',
        lineHeight: 1.6,
    },
    hash: {
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#aaa',
        background: '#1a1a1a',
        padding: '2px 6px',
        borderRadius: 4,
    },
    errorBox: {
        background: '#2b0d0d',
        border: '1px solid #4a1a1a',
        color: '#f44336',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
    },
    modalActions: {
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: 10,
    },
    cancelBtn: {
        background: 'transparent',
        border: '1px solid #2a2a2a',
        color: '#555',
        padding: '12px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 14,
    },
    actionBtn: {
        background: 'linear-gradient(135deg, #f7931a, #e07b00)',
        border: '1px solid transparent',
        color: '#000',
        padding: '12px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
    },
};
