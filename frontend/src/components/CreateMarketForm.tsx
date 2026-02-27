import { useState } from 'react';

interface CreateMarketFormProps {
    onSubmit: (asset: number, strikePrice: bigint, expiryBlock: bigint) => Promise<void>;
    currentBlock: bigint;
}

const ASSETS = [
    { id: 0, label: 'BTC', icon: '₿' },
    { id: 1, label: 'ETH', icon: 'Ξ' },
];

export function CreateMarketForm({ onSubmit, currentBlock }: CreateMarketFormProps) {
    const [asset, setAsset] = useState(0);
    const [strikePriceUsd, setStrikePriceUsd] = useState('');
    const [blocksFromNow, setBlocksFromNow] = useState('1000');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit() {
        const price = parseFloat(strikePriceUsd);
        const blocks = parseInt(blocksFromNow, 10);

        if (isNaN(price) || price <= 0) {
            setError('Enter a valid strike price');
            return;
        }
        if (isNaN(blocks) || blocks < 10) {
            setError('Expiry must be at least 10 blocks from now');
            return;
        }

        // Convert USD to 8-decimal bigint
        const strikePrice = BigInt(Math.floor(price * 1e8));
        const expiryBlock = currentBlock + BigInt(blocks);

        setLoading(true);
        setError(null);
        try {
            await onSubmit(asset, strikePrice, expiryBlock);
            setStrikePriceUsd('');
            setBlocksFromNow('1000');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create market');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={styles.form}>
            <h3 style={styles.formTitle}>Create Market (Admin)</h3>

            <div style={styles.field}>
                <label style={styles.label}>Asset</label>
                <div style={styles.assetRow}>
                    {ASSETS.map((a) => (
                        <button
                            key={a.id}
                            style={{
                                ...styles.assetBtn,
                                ...(asset === a.id ? styles.assetBtnActive : {}),
                            }}
                            onClick={() => setAsset(a.id)}
                        >
                            <span>{a.icon}</span> {a.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={styles.field}>
                <label style={styles.label}>Strike Price (USD)</label>
                <div style={styles.inputRow}>
                    <span style={styles.prefix}>$</span>
                    <input
                        type="number"
                        value={strikePriceUsd}
                        onChange={(e) => setStrikePriceUsd(e.target.value)}
                        placeholder="100000"
                        style={styles.input}
                    />
                </div>
            </div>

            <div style={styles.field}>
                <label style={styles.label}>Expires In (blocks)</label>
                <div style={styles.inputRow}>
                    <input
                        type="number"
                        value={blocksFromNow}
                        onChange={(e) => setBlocksFromNow(e.target.value)}
                        placeholder="1000"
                        style={styles.input}
                        min="10"
                    />
                </div>
                <span style={styles.hint}>
                    Expiry block: {(currentBlock + BigInt(parseInt(blocksFromNow) || 0)).toLocaleString()}
                </span>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <button style={styles.submitBtn} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating…' : 'Create Market'}
            </button>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    form: {
        background: '#111',
        border: '1px solid #1e1e1e',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        maxWidth: 440,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: 700,
        color: '#f7931a',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    label: {
        fontSize: 13,
        color: '#888',
        fontWeight: 500,
    },
    assetRow: {
        display: 'flex',
        gap: 8,
    },
    assetBtn: {
        background: '#0d0d0d',
        border: '1px solid #2a2a2a',
        color: '#555',
        padding: '8px 18px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    assetBtnActive: {
        background: '#1a1a0d',
        border: '1px solid #f7931a',
        color: '#f7931a',
    },
    inputRow: {
        display: 'flex',
        alignItems: 'center',
        background: '#0d0d0d',
        border: '1px solid #2a2a2a',
        borderRadius: 10,
        overflow: 'hidden',
    },
    prefix: {
        padding: '0 10px 0 14px',
        color: '#555',
        fontSize: 16,
    },
    input: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        color: '#fff',
        padding: '12px 14px 12px 0',
        fontSize: 15,
        outline: 'none',
    },
    hint: {
        fontSize: 12,
        color: '#444',
    },
    errorBox: {
        background: '#2b0d0d',
        border: '1px solid #4a1a1a',
        color: '#f44336',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
    },
    submitBtn: {
        background: 'linear-gradient(135deg, #f7931a, #e07b00)',
        border: 'none',
        color: '#000',
        padding: '12px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
    },
};
