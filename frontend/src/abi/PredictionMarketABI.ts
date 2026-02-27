import { ABIDataTypes, BitcoinAbiTypes, IFunctionAbi, IFunctionAbiWithSelector } from '@btc-vision/transaction';

// Full ABI definition for the PredictionMarket contract
export const PREDICTION_MARKET_ABI: IFunctionAbiWithSelector[] = [
    {
        name: 'createMarket',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'asset', type: ABIDataTypes.UINT32 },
            { name: 'strikePrice', type: ABIDataTypes.UINT256 },
            { name: 'expiryBlock', type: ABIDataTypes.UINT64 },
        ],
        outputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        name: 'placeBet',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
            { name: 'isYes', type: ABIDataTypes.BOOL },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
    {
        name: 'resolveMarket',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
            { name: 'outcome', type: ABIDataTypes.BOOL },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
    {
        name: 'claimWinnings',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'amountClaimed', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        name: 'getMarket',
        type: BitcoinAbiTypes.Function,
        constant: true,
        payable: false,
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'asset', type: ABIDataTypes.UINT32 },
            { name: 'strikePrice', type: ABIDataTypes.UINT256 },
            { name: 'expiryBlock', type: ABIDataTypes.UINT64 },
            { name: 'yesPool', type: ABIDataTypes.UINT256 },
            { name: 'noPool', type: ABIDataTypes.UINT256 },
            { name: 'resolved', type: ABIDataTypes.BOOL },
            { name: 'outcome', type: ABIDataTypes.BOOL },
        ],
    },
    {
        name: 'getUserPosition',
        type: BitcoinAbiTypes.Function,
        constant: true,
        payable: false,
        inputs: [
            { name: 'marketId', type: ABIDataTypes.UINT256 },
            { name: 'user', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [
            { name: 'yesShares', type: ABIDataTypes.UINT256 },
            { name: 'noShares', type: ABIDataTypes.UINT256 },
            { name: 'claimed', type: ABIDataTypes.BOOL },
        ],
    },
    {
        name: 'getMarketCount',
        type: BitcoinAbiTypes.Function,
        constant: true,
        payable: false,
        inputs: [],
        outputs: [
            { name: 'count', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        name: 'getCollateralToken',
        type: BitcoinAbiTypes.Function,
        constant: true,
        payable: false,
        inputs: [],
        outputs: [
            { name: 'token', type: ABIDataTypes.ADDRESS },
        ],
    },
    {
        name: 'setAdmin',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'newAdmin', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
    {
        name: 'setFeeCollector',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'newCollector', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
    {
        name: 'setProtocolFee',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'feeBps', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
] as unknown as IFunctionAbiWithSelector[];

// Minimal OP20 ABI — only allowance + approve, used for the approval flow
export const OP20_APPROVAL_ABI: IFunctionAbiWithSelector[] = [
    {
        name: 'allowance',
        type: BitcoinAbiTypes.Function,
        constant: true,
        payable: false,
        inputs: [
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'spender', type: ABIDataTypes.ADDRESS },
        ],
        outputs: [
            { name: 'remaining', type: ABIDataTypes.UINT256 },
        ],
    },
    {
        name: 'approve',
        type: BitcoinAbiTypes.Function,
        constant: false,
        payable: false,
        inputs: [
            { name: 'spender', type: ABIDataTypes.ADDRESS },
            { name: 'amount', type: ABIDataTypes.UINT256 },
        ],
        outputs: [
            { name: 'success', type: ABIDataTypes.BOOL },
        ],
    },
] as unknown as IFunctionAbiWithSelector[];

// Asset labels
export const ASSET_LABELS: Record<number, string> = {
    0: 'BTC',
    1: 'ETH',
};

export const ASSET_ICONS: Record<number, string> = {
    0: '₿',
    1: 'Ξ',
};
