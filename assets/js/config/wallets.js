// Wallet Configuration - Enhanced with WalletConnect Support

export const WALLET_TYPES = {
  METAMASK: 'metamask',
  FLUENT: 'fluent',
  OKX: 'okx',
  HALO: 'halo',
  TOKENPOCKET: 'tokenpocket',
  WALLETCONNECT: 'walletconnect',
  COINBASE: 'coinbase',
  TRUST: 'trust',
};

export const WALLET_INFO = {
  [WALLET_TYPES.METAMASK]: {
    name: 'MetaMask',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
    description: 'Connect with MetaMask browser extension',
    downloadUrl: 'https://metamask.io/download/',
    type: 'injected',
    checkInstalled: () => typeof window !== 'undefined' && window.ethereum?.isMetaMask,
  },

  [WALLET_TYPES.FLUENT]: {
    name: 'Fluent Wallet',
    icon: 'https://app.swappi.io/static/media/fluent.25536d72.svg',
    description: 'Official Conflux wallet - Best for Conflux network',
    downloadUrl: 'https://fluentwallet.com/',
    type: 'injected',
    checkInstalled: () => typeof window !== 'undefined' && (
      window.conflux?.isConflux ||
      window.ethereum?.isConflux ||
      window.ethereum?.providers?.some(p => p.isConflux)
    ),
  },

  [WALLET_TYPES.OKX]: {
    name: 'OKX Wallet',
    // Official OKX Wallet icon (green background)
    icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAP1BMVEWa7SwAAACb7yyc8C2h+C4ZJwee8y2P3Cl/wySDySWR3yoYJQem/y8WIgaN2CiT4ioJDgMeLgmX6Cs3VRCI0SdP60sXAAAAlUlEQVQ4jdWSyxKDIAxFNRAQwUpp//9byyUujI9x0WmnPavAPSOG0HV/BIF1TRvhBmbJR19rb9axGXqQLRau1f1IeyFeCfy20I6gQyG0vXtylSTCrLo0FhSJUltsLwIf9yK4ffQN4eAndR4yM0+P4iuFI3PMqs3loiaLOX90FpfC+YOhEsCTpCUw6FmQActeq9WT/HVejigFsTJBQS8AAAAASUVORK5CYII=',
    description: 'Connect with OKX Wallet extension',
    downloadUrl: 'https://www.okx.com/web3',
    type: 'injected',
    // Detection: on mobile always show (uses WalletConnect), on desktop check extension
    // Official docs: https://web3.okx.com/build/dev-docs/sdks/web-detect-okx-wallet
    checkInstalled: () => {
      if (typeof window === 'undefined') return false;

      // On mobile, always return true - we'll use WalletConnect
      // OKX app supports scanning WalletConnect QR codes
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        console.log('[OKX Detection] Mobile device - showing OKX option (will use WalletConnect)');
        return true;
      }

      // Desktop: check for browser extension
      console.log('[OKX Detection] Desktop - checking for extension...');

      // Official OKX detection method
      if (typeof window.okxwallet !== 'undefined') {
        console.log('[OKX Detection] ✓ Found via window.okxwallet');
        return true;
      }

      if (window.ethereum?.isOkxWallet) {
        console.log('[OKX Detection] ✓ Found via window.ethereum.isOkxWallet');
        return true;
      }

      // Check providers array (multi-wallet scenario)
      if (window.ethereum?.providers?.some(p => p.isOkxWallet)) {
        console.log('[OKX Detection] ✓ Found in ethereum.providers[]');
        return true;
      }

      console.log('[OKX Detection] ✗ Extension not found');
      return false;
    },
  },

  [WALLET_TYPES.HALO]: {
    name: 'Halo Wallet',
    icon: 'https://halo.social/assets/images/halo-icon.png',
    description: 'Social wallet by Halo',
    downloadUrl: 'https://halo.social/',
    type: 'injected',
    checkInstalled: () => typeof window !== 'undefined' && window.halo !== undefined,
  },

  [WALLET_TYPES.TOKENPOCKET]: {
    name: 'TokenPocket',
    icon: 'https://www.tokenpocket.pro/img/logo.png',
    description: 'Multi-chain wallet supporting 80+ blockchains',
    downloadUrl: 'https://www.tokenpocket.pro/',
    type: 'injected',
    checkInstalled: () => typeof window !== 'undefined' && window.ethereum?.isTokenPocket,
  },

  [WALLET_TYPES.WALLETCONNECT]: {
    name: 'WalletConnect',
    icon: 'https://raw.githubusercontent.com/WalletConnect/walletconnect-assets/master/Logo/Blue%20(Default)/Logo.svg',
    description: 'Scan QR code with your mobile wallet (500+ wallets)',
    downloadUrl: 'https://walletconnect.com/',
    type: 'walletconnect',
    checkInstalled: () => true, // Always available via QR code
  },

  [WALLET_TYPES.COINBASE]: {
    name: 'Coinbase Wallet',
    icon: 'https://images.ctfassets.net/q5ulk4bp65r7/3TBS4oVkD1ghowTqVQJlqj/d9bcb819cc02cc37abc8f7fd98754d23/coinbase_icon.svg',
    description: 'Connect with Coinbase Wallet',
    downloadUrl: 'https://www.coinbase.com/wallet',
    type: 'injected',
    checkInstalled: () => typeof window !== 'undefined' && window.ethereum?.isCoinbaseWallet,
  },

  [WALLET_TYPES.TRUST]: {
    name: 'Trust Wallet',
    icon: 'https://trustwallet.com/assets/images/media/assets/TWT.png',
    description: 'Connect with Trust Wallet',
    downloadUrl: 'https://trustwallet.com/',
    type: 'injected',
    checkInstalled: () => typeof window !== 'undefined' && window.ethereum?.isTrust,
  },
};

// WalletConnect Project Configuration
export const WALLETCONNECT_CONFIG = {
  projectId: '11b226f3b4df0a5e1faefb396f421a79',
  metadata: {
    name: 'CONFLUX ARENA',
    description: 'Conflux Arena - Gaming and DeFi Platform',
    url: 'https://confluxarena.org',
    icons: ['https://confluxarena.org/assets/images/logos/ArenaLogo.png'],
  },
  themeMode: 'dark', // 'light' | 'dark' | 'auto'
  themeVariables: {
    '--w3m-accent': '#38A1D8', // Conflux blue
    '--w3m-border-radius-master': '12px',
  },
};

// Featured wallets for WalletConnect modal
export const FEATURED_WALLET_IDS = [
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
  '5d9f1395b3a8e848684848dc4147cbd05c8d54bb737eac78fe103901fe6b01a1', // OKX Wallet (updated 2025)
  '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66', // TokenPocket
  '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
];

// Helper function to get installed wallets
export function getInstalledWallets() {
  return Object.entries(WALLET_INFO)
    .filter(([type, info]) => {
      if (info.type === 'walletconnect') return true;
      return info.checkInstalled();
    })
    .map(([type]) => type);
}

// Helper function to get all available wallets (including not installed)
export function getAllWallets() {
  return Object.keys(WALLET_INFO);
}

// Helper function to check if specific wallet is installed
export function isWalletInstalled(walletType) {
  const walletInfo = WALLET_INFO[walletType];
  return walletInfo ? walletInfo.checkInstalled() : false;
}
