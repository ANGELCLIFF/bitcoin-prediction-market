import { useState } from 'react';

interface HeaderProps {
    address: string | null;
    onConnect: () => void;
    onDisconnect: () => void;
}

export function Header({ address, onConnect, onDisconnect }: HeaderProps) {
    const [copied, setCopied] = useState(false);

    const shortAddress = address
        ? `${address.slice(0, 6)}…${address.slice(-4)}`
        : null;

    function copyAddress() {
        if (!address) return;
        void navigator.clipboard.writeText(address).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    return (
        <header style={styles.header}>
            <div style={styles.inner}>
                <div style={styles.brand}>
                    <span style={styles.logo}>⚡</span>
                    <span style={styles.title}>PredictBTC</span>
                    <span style={styles.tagline}>Bitcoin-Native Prediction Markets</span>
                </div>

                <nav style={styles.nav}>
                    {address ? (
                        <div style={styles.walletRow}>
                            <button style={styles.addressBtn} onClick={copyAddress}>
                                {copied ? '✓ Copied' : shortAddress}
                            </button>
                            <button style={styles.disconnectBtn} onClick={onDisconnect}>
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button style={styles.connectBtn} onClick={onConnect}>
                            Connect OP_WALLET
                        </button>
                    )}
                </nav>
            </div>
        </header>
    );
}

const styles: Record<string, React.CSSProperties> = {
    header: {
        background: 'rgba(10,10,10,0.95)',
        borderBottom: '1px solid #1e1e1e',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
    },
    inner: {
        maxWidth: 1200,
        margin: '0 auto',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    logo: {
        fontSize: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: 700,
        color: '#f7931a',
        letterSpacing: '-0.5px',
    },
    tagline: {
        fontSize: 12,
        color: '#555',
        marginLeft: 4,
        display: 'none' as const,
    },
    nav: {
        display: 'flex',
        alignItems: 'center',
    },
    walletRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    addressBtn: {
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        color: '#aaa',
        padding: '7px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'monospace',
    },
    disconnectBtn: {
        background: 'transparent',
        border: '1px solid #333',
        color: '#666',
        padding: '7px 12px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
    },
    connectBtn: {
        background: 'linear-gradient(135deg, #f7931a, #e07b00)',
        border: 'none',
        color: '#000',
        padding: '9px 18px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
    },
};
