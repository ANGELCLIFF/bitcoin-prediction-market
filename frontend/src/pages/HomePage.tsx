import { useCallback, useEffect, useState } from 'react';
import { MarketCard } from '../components/MarketCard';
import { CreateMarketForm } from '../components/CreateMarketForm';
import { usePredictionMarket, type UserPosition } from '../hooks/usePredictionMarket';
import type { MarketData } from '../hooks/usePredictionMarket';
import { ASSET_LABELS } from '../abi/PredictionMarketABI';

interface HomePageProps {
    userAddress: string | null;
    isAdmin: boolean;
}

type FilterAsset = 'all' | 'btc' | 'eth';
type FilterStatus = 'all' | 'live' | 'resolved';

export function HomePage({ userAddress, isAdmin }: HomePageProps) {
    const {
        markets,
        loading,
        error,
        fetchAllMarkets,
        fetchUserPosition,
        checkAllowance,
        approveToken,
        placeBet,
        claimWinnings,
        createMarket,
        resolveMarket,
    } = usePredictionMarket();

    const [userPositions, setUserPositions] = useState<Map<string, UserPosition>>(new Map());
    const [filterAsset, setFilterAsset] = useState<FilterAsset>('all');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('live');
    const [txFeedback, setTxFeedback] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Load user positions for all markets whenever address or markets change
    useEffect(() => {
        if (!userAddress || markets.length === 0) return;

        const loadPositions = async () => {
            const positions = new Map<string, UserPosition>();
            await Promise.allSettled(
                markets.map(async (m) => {
                    const pos = await fetchUserPosition(m.id, userAddress);
                    if (pos) positions.set(m.id.toString(), pos);
                }),
            );
            setUserPositions(new Map(positions));
        };

        void loadPositions();
    }, [userAddress, markets, fetchUserPosition]);

    const handleBet = useCallback(
        async (marketId: bigint, isYes: boolean, amount: bigint) => {
            if (!userAddress) return;
            try {
                const hash = await placeBet(marketId, isYes, amount, userAddress);
                setTxFeedback(`Bet placed! TX: ${hash?.slice(0, 16)}…`);
                setTimeout(() => setTxFeedback(null), 6000);
                await fetchAllMarkets();
            } catch (err) {
                setTxFeedback(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setTimeout(() => setTxFeedback(null), 6000);
            }
        },
        [userAddress, placeBet, fetchAllMarkets],
    );

    const handleClaim = useCallback(
        async (marketId: bigint) => {
            if (!userAddress) return;
            try {
                const hash = await claimWinnings(marketId, userAddress);
                setTxFeedback(`Winnings claimed! TX: ${hash?.slice(0, 16)}…`);
                setTimeout(() => setTxFeedback(null), 6000);
                await fetchAllMarkets();
            } catch (err) {
                setTxFeedback(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setTimeout(() => setTxFeedback(null), 6000);
            }
        },
        [userAddress, claimWinnings, fetchAllMarkets],
    );

    const handleResolve = useCallback(
        async (marketId: bigint, outcome: boolean) => {
            if (!userAddress) return;
            try {
                const hash = await resolveMarket(marketId, outcome, userAddress);
                setTxFeedback(`Market resolved! TX: ${hash?.slice(0, 16)}…`);
                setTimeout(() => setTxFeedback(null), 6000);
                await fetchAllMarkets();
            } catch (err) {
                setTxFeedback(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setTimeout(() => setTxFeedback(null), 6000);
            }
        },
        [userAddress, resolveMarket, fetchAllMarkets],
    );

    const handleCreateMarket = useCallback(
        async (asset: number, strikePrice: bigint, expiryBlock: bigint) => {
            if (!userAddress) return;
            const hash = await createMarket(asset, strikePrice, expiryBlock, userAddress);
            setTxFeedback(`Market created! TX: ${hash?.slice(0, 16)}…`);
            setTimeout(() => setTxFeedback(null), 6000);
            setShowCreateForm(false);
            await fetchAllMarkets();
        },
        [userAddress, createMarket, fetchAllMarkets],
    );

    // Filter markets
    const filteredMarkets = markets.filter((m) => {
        if (filterAsset === 'btc' && m.asset !== 0) return false;
        if (filterAsset === 'eth' && m.asset !== 1) return false;
        if (filterStatus === 'live' && m.resolved) return false;
        if (filterStatus === 'resolved' && !m.resolved) return false;
        return true;
    });

    const liveCount = markets.filter((m) => !m.resolved).length;
    const resolvedCount = markets.filter((m) => m.resolved).length;

    // Approximate current block from latest market expiry (placeholder)
    const currentBlock = markets.reduce((max, m) => (m.expiryBlock > max ? m.expiryBlock : max), 0n);

    return (
        <main style={styles.main}>
            {/* Stats bar */}
            <div style={styles.statsBar}>
                <div style={styles.stat}>
                    <span style={styles.statValue}>{markets.length}</span>
                    <span style={styles.statLabel}>Total Markets</span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.stat}>
                    <span style={styles.statValue}>{liveCount}</span>
                    <span style={styles.statLabel}>Live</span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.stat}>
                    <span style={styles.statValue}>{resolvedCount}</span>
                    <span style={styles.statLabel}>Resolved</span>
                </div>
                <div style={styles.statDivider} />
                <div style={styles.stat}>
                    <span style={styles.statValue}>BTC + ETH</span>
                    <span style={styles.statLabel}>Assets</span>
                </div>
            </div>

            {/* Hero */}
            <div style={styles.hero}>
                <h1 style={styles.heroTitle}>
                    Predict <span style={styles.btcAccent}>Bitcoin</span> &{' '}
                    <span style={styles.ethAccent}>Ethereum</span> Prices
                </h1>
                <p style={styles.heroSub}>
                    Decentralized prediction markets on Bitcoin L1 via OPNet.
                    No intermediaries. No custody. Fully on-chain.
                </p>
                {isAdmin && (
                    <button
                        style={styles.createBtn}
                        onClick={() => setShowCreateForm((v) => !v)}
                    >
                        {showCreateForm ? '✕ Cancel' : '+ Create Market'}
                    </button>
                )}
            </div>

            {/* Create market form (admin only) */}
            {showCreateForm && isAdmin && (
                <div style={styles.createFormWrapper}>
                    <CreateMarketForm
                        onSubmit={handleCreateMarket}
                        currentBlock={currentBlock}
                    />
                </div>
            )}

            {/* TX feedback */}
            {txFeedback && (
                <div style={styles.feedback}>
                    {txFeedback}
                </div>
            )}

            {/* Filters */}
            <div style={styles.filters}>
                <div style={styles.filterGroup}>
                    <span style={styles.filterLabel}>Asset:</span>
                    {(['all', 'btc', 'eth'] as FilterAsset[]).map((f) => (
                        <button
                            key={f}
                            style={{
                                ...styles.filterBtn,
                                ...(filterAsset === f ? styles.filterBtnActive : {}),
                            }}
                            onClick={() => setFilterAsset(f)}
                        >
                            {f === 'all' ? 'All' : f.toUpperCase()}
                        </button>
                    ))}
                </div>
                <div style={styles.filterGroup}>
                    <span style={styles.filterLabel}>Status:</span>
                    {(['all', 'live', 'resolved'] as FilterStatus[]).map((f) => (
                        <button
                            key={f}
                            style={{
                                ...styles.filterBtn,
                                ...(filterStatus === f ? styles.filterBtnActive : {}),
                            }}
                            onClick={() => setFilterStatus(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <button style={styles.refreshBtn} onClick={fetchAllMarkets} disabled={loading}>
                    {loading ? '↻ Loading…' : '↻ Refresh'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={styles.errorBanner}>
                    {error}
                </div>
            )}

            {/* Market grid */}
            {loading && markets.length === 0 ? (
                <div style={styles.loadingState}>
                    <div style={styles.spinner} />
                    <span>Loading markets…</span>
                </div>
            ) : filteredMarkets.length === 0 ? (
                <div style={styles.emptyState}>
                    <span style={styles.emptyIcon}>📊</span>
                    <span>No markets found</span>
                    {isAdmin && <span style={styles.emptyHint}>Create the first market above</span>}
                </div>
            ) : (
                <div style={styles.grid}>
                    {filteredMarkets.map((market) => (
                        <MarketCard
                            key={market.id.toString()}
                            market={market}
                            userAddress={userAddress}
                            isAdmin={isAdmin}
                            onBet={handleBet}
                            onClaim={handleClaim}
                            onResolve={handleResolve}
                            checkAllowance={checkAllowance}
                            approveToken={approveToken}
                            userPosition={userPositions.get(market.id.toString()) ?? null}
                        />
                    ))}
                </div>
            )}
        </main>
    );
}

const styles: Record<string, React.CSSProperties> = {
    main: {
        maxWidth: 1200,
        margin: '0 auto',
        padding: '40px 24px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
    },
    statsBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        background: '#111',
        border: '1px solid #1e1e1e',
        borderRadius: 12,
        padding: '14px 24px',
    },
    stat: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 700,
        color: '#fff',
    },
    statLabel: {
        fontSize: 12,
        color: '#555',
    },
    statDivider: {
        width: 1,
        height: 32,
        background: '#1e1e1e',
    },
    hero: {
        textAlign: 'center' as const,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '20px 0',
    },
    heroTitle: {
        fontSize: 'clamp(28px, 5vw, 48px)',
        fontWeight: 800,
        color: '#fff',
        lineHeight: 1.2,
        letterSpacing: '-1px',
    },
    btcAccent: {
        color: '#f7931a',
    },
    ethAccent: {
        color: '#627eea',
    },
    heroSub: {
        fontSize: 16,
        color: '#666',
        maxWidth: 520,
        lineHeight: 1.6,
    },
    createBtn: {
        background: 'linear-gradient(135deg, #f7931a, #e07b00)',
        border: 'none',
        color: '#000',
        padding: '10px 22px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 700,
    },
    createFormWrapper: {
        display: 'flex',
        justifyContent: 'center',
    },
    feedback: {
        background: '#0d1a0d',
        border: '1px solid #1a4a1a',
        color: '#4caf50',
        padding: '12px 18px',
        borderRadius: 10,
        fontSize: 13,
        fontFamily: 'monospace',
    },
    filters: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap' as const,
    },
    filterGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    filterLabel: {
        fontSize: 13,
        color: '#555',
        marginRight: 4,
    },
    filterBtn: {
        background: '#111',
        border: '1px solid #222',
        color: '#555',
        padding: '6px 14px',
        borderRadius: 100,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
    },
    filterBtnActive: {
        background: '#1a1a0d',
        border: '1px solid #f7931a',
        color: '#f7931a',
    },
    refreshBtn: {
        marginLeft: 'auto',
        background: 'transparent',
        border: '1px solid #222',
        color: '#555',
        padding: '6px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
    },
    errorBanner: {
        background: '#2b0d0d',
        border: '1px solid #4a1a1a',
        color: '#f44336',
        padding: '12px 18px',
        borderRadius: 10,
        fontSize: 13,
    },
    loadingState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '80px 0',
        color: '#555',
        fontSize: 15,
    },
    spinner: {
        width: 36,
        height: 36,
        border: '3px solid #222',
        borderTop: '3px solid #f7931a',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '80px 0',
        color: '#555',
        fontSize: 15,
    },
    emptyIcon: {
        fontSize: 40,
    },
    emptyHint: {
        fontSize: 13,
        color: '#333',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 20,
    },
};
