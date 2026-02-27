import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';

// Admin address — set this to your deployer address
const ADMIN_ADDRESS = import.meta.env.VITE_ADMIN_ADDRESS ?? '';

export default function App() {
    const [address, setAddress] = useState<string | null>(null);

    const connect = useCallback(async () => {
        try {
            // OP_WALLET exposes window.opnet — request accounts
            const opnet = (window as unknown as { opnet?: { requestAccounts: () => Promise<string[]> } }).opnet;
            if (!opnet) {
                alert('OP_WALLET not found. Please install the OP_WALLET browser extension.');
                return;
            }
            const accounts = await opnet.requestAccounts();
            if (accounts.length > 0) setAddress(accounts[0]);
        } catch (err) {
            console.error('Wallet connection failed:', err);
        }
    }, []);

    const disconnect = useCallback(() => {
        setAddress(null);
    }, []);

    const isAdmin = Boolean(ADMIN_ADDRESS && address && address.toLowerCase() === ADMIN_ADDRESS.toLowerCase());

    return (
        <>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed !important;
                }
                input[type=number]::-webkit-inner-spin-button,
                input[type=number]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            `}</style>
            <Header address={address} onConnect={connect} onDisconnect={disconnect} />
            <HomePage userAddress={address} isAdmin={isAdmin} />
        </>
    );
}
