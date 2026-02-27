import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getContract, JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';
import { OP20_APPROVAL_ABI, PREDICTION_MARKET_ABI } from '../abi/PredictionMarketABI';

// Network config — use opnetTestnet for OPNet testnet (Signet fork)
const NETWORK = networks.opnetTestnet;
const RPC_URL = 'https://testnet.opnet.org';

// Replace with your deployed contract address
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? '';
const COLLATERAL_TOKEN_ADDRESS = import.meta.env.VITE_COLLATERAL_TOKEN ?? '';

export interface MarketData {
    id: bigint;
    asset: number;
    strikePrice: bigint;
    expiryBlock: bigint;
    yesPool: bigint;
    noPool: bigint;
    resolved: boolean;
    outcome: boolean;
}

export interface UserPosition {
    yesShares: bigint;
    noShares: bigint;
    claimed: boolean;
}

function getProvider(): JSONRpcProvider {
    return new JSONRpcProvider(RPC_URL, NETWORK);
}

function getMarketContract(provider: JSONRpcProvider) {
    return getContract(CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, provider, NETWORK);
}

function getTokenContract(provider: JSONRpcProvider) {
    return getContract(COLLATERAL_TOKEN_ADDRESS, OP20_APPROVAL_ABI, provider, NETWORK);
}

export function usePredictionMarket() {
    const [markets, setMarkets] = useState<MarketData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const providerRef = useRef<JSONRpcProvider | null>(null);

    const provider = useMemo(() => {
        if (!providerRef.current) {
            providerRef.current = getProvider();
        }
        return providerRef.current;
    }, []);

    const fetchAllMarkets = useCallback(async () => {
        if (!CONTRACT_ADDRESS) return;
        setLoading(true);
        setError(null);

        try {
            const contract = getMarketContract(provider);

            // Get total market count
            const countResult = await contract.getMarketCount();
            if (!countResult.decoded) throw new Error('Failed to get market count');

            const count = countResult.decoded.count as bigint;
            const fetched: MarketData[] = [];

            // Fetch each market in parallel (batch of up to 20)
            const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
            const results = await Promise.allSettled(
                ids.map(async (id) => {
                    const res = await contract.getMarket(id);
                    if (!res.decoded) return null;
                    return {
                        id,
                        asset: Number(res.decoded.asset),
                        strikePrice: res.decoded.strikePrice as bigint,
                        expiryBlock: res.decoded.expiryBlock as bigint,
                        yesPool: res.decoded.yesPool as bigint,
                        noPool: res.decoded.noPool as bigint,
                        resolved: res.decoded.resolved as boolean,
                        outcome: res.decoded.outcome as boolean,
                    } satisfies MarketData;
                }),
            );

            for (const r of results) {
                if (r.status === 'fulfilled' && r.value) fetched.push(r.value);
            }

            setMarkets(fetched);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load markets');
        } finally {
            setLoading(false);
        }
    }, [provider]);

    useEffect(() => {
        void fetchAllMarkets();
    }, [fetchAllMarkets]);

    const fetchUserPosition = useCallback(
        async (marketId: bigint, userAddress: string): Promise<UserPosition | null> => {
            if (!CONTRACT_ADDRESS) return null;
            try {
                const contract = getMarketContract(provider);
                const res = await contract.getUserPosition(marketId, userAddress);
                if (!res.decoded) return null;
                return {
                    yesShares: res.decoded.yesShares as bigint,
                    noShares: res.decoded.noShares as bigint,
                    claimed: res.decoded.claimed as boolean,
                };
            } catch {
                return null;
            }
        },
        [provider],
    );

    const placeBet = useCallback(
        async (
            marketId: bigint,
            isYes: boolean,
            amount: bigint,
            userAddress: string,
        ): Promise<string | null> => {
            if (!CONTRACT_ADDRESS) throw new Error('Contract not configured');

            const contract = getMarketContract(provider);

            // Simulate first
            const sim = await contract.placeBet(marketId, isYes, amount);
            if (!sim.success) throw new Error(`Simulation failed: ${sim.error ?? 'unknown'}`);

            // Send — wallet handles signing (signer: null on frontend)
            const receipt = await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: userAddress,
                maximumAllowedSatToSpend: 10_000n,
                network: NETWORK,
            });

            return receipt?.hash ?? null;
        },
        [provider],
    );

    const claimWinnings = useCallback(
        async (marketId: bigint, userAddress: string): Promise<string | null> => {
            if (!CONTRACT_ADDRESS) throw new Error('Contract not configured');

            const contract = getMarketContract(provider);

            const sim = await contract.claimWinnings(marketId);
            if (!sim.success) throw new Error(`Simulation failed: ${sim.error ?? 'unknown'}`);

            const receipt = await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: userAddress,
                maximumAllowedSatToSpend: 10_000n,
                network: NETWORK,
            });

            return receipt?.hash ?? null;
        },
        [provider],
    );

    const createMarket = useCallback(
        async (
            asset: number,
            strikePrice: bigint,
            expiryBlock: bigint,
            userAddress: string,
        ): Promise<string | null> => {
            if (!CONTRACT_ADDRESS) throw new Error('Contract not configured');

            const contract = getMarketContract(provider);

            const sim = await contract.createMarket(asset, strikePrice, expiryBlock);
            if (!sim.success) throw new Error(`Simulation failed: ${sim.error ?? 'unknown'}`);

            const receipt = await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: userAddress,
                maximumAllowedSatToSpend: 10_000n,
                network: NETWORK,
            });

            return receipt?.hash ?? null;
        },
        [provider],
    );

    const checkAllowance = useCallback(
        async (ownerAddress: string, amount: bigint): Promise<boolean> => {
            if (!COLLATERAL_TOKEN_ADDRESS || !CONTRACT_ADDRESS) return true;
            try {
                const contract = getTokenContract(provider);
                const res = await contract.allowance(ownerAddress, CONTRACT_ADDRESS);
                if (!res.decoded) return false;
                return (res.decoded.remaining as bigint) >= amount;
            } catch {
                return false;
            }
        },
        [provider],
    );

    const approveToken = useCallback(
        async (amount: bigint, userAddress: string): Promise<string | null> => {
            if (!COLLATERAL_TOKEN_ADDRESS) throw new Error('Collateral token not configured');

            const contract = getTokenContract(provider);

            const sim = await contract.approve(CONTRACT_ADDRESS, amount);
            if (!sim.success) throw new Error(`Approval simulation failed: ${sim.error ?? 'unknown'}`);

            const receipt = await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: userAddress,
                maximumAllowedSatToSpend: 10_000n,
                network: NETWORK,
            });

            return receipt?.hash ?? null;
        },
        [provider],
    );

    const resolveMarket = useCallback(
        async (marketId: bigint, outcome: boolean, userAddress: string): Promise<string | null> => {
            if (!CONTRACT_ADDRESS) throw new Error('Contract not configured');

            const contract = getMarketContract(provider);

            const sim = await contract.resolveMarket(marketId, outcome);
            if (!sim.success) throw new Error(`Simulation failed: ${sim.error ?? 'unknown'}`);

            const receipt = await sim.sendTransaction({
                signer: null,
                mldsaSigner: null,
                refundTo: userAddress,
                maximumAllowedSatToSpend: 10_000n,
                network: NETWORK,
            });

            return receipt?.hash ?? null;
        },
        [provider],
    );

    return {
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
        collateralTokenAddress: COLLATERAL_TOKEN_ADDRESS,
    };
}
