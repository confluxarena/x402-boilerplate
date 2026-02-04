// Reown AppKit Service for WalletConnect v2
// Uses Reown AppKit CDN for Conflux eSpace

// Project configuration from Reown Dashboard
const WALLETCONNECT_PROJECT_ID = '11b226f3b4df0a5e1faefb396f421a79';

// Conflux eSpace network configuration (EIP-3085 format)
const confluxEspace = {
  id: 1030,
  name: 'Conflux eSpace',
  nativeCurrency: {
    name: 'CFX',
    symbol: 'CFX',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ['https://evm.confluxrpc.com']
    }
  },
  blockExplorers: {
    default: {
      name: 'ConfluxScan',
      url: 'https://evm.confluxscan.io'
    }
  }
};

// Metadata for WalletConnect
// Note: redirect is NOT needed for connecting TO wallets
// It's only used if you're building a WALLET app that needs to redirect back to dApp
const metadata = {
  name: 'Conflux Arena',
  description: 'Conflux Arena - Gaming and DeFi Quest Platform',
  url: 'https://confluxarena.org',
  icons: ['https://confluxarena.org/assets/images/logos/ArenaLogo.png']
};

// Featured wallet IDs from WalletConnect Explorer
// These wallets will be shown prominently in the modal
const FEATURED_WALLET_IDS = [
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
  '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
  '5d9f1395b3a8e848684848dc4147cbd05c8d54bb737eac78fe103901fe6b01a1', // OKX Wallet (updated 2025)
  '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4', // Binance Web3
  '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66', // TokenPocket
  '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // BitGet
  '15c8b91ade1a4e58f3ce4e7a0dd7f42b47db0c8df7e0d84f63eb39bcb96c4e0f', // imToken
];

class AppKitService {
  constructor() {
    this.modal = null;
    this.provider = null;
    this.address = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.cdnLoaded = false;
    // Track connection state
    this._lastAddress = null;
    this._isWaitingForConnection = false;  // Only dispatch events when actively connecting
  }

  // Clear old WalletConnect sessions from localStorage
  clearOldSessions() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('wc@') ||
          key.startsWith('walletconnect') ||
          key.startsWith('WC_') ||
          key.startsWith('@appkit') ||
          key.includes('wagmi')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        console.log('[AppKit] Clearing old session:', key);
        localStorage.removeItem(key);
      });
      if (keysToRemove.length > 0) {
        console.log('[AppKit] Cleared', keysToRemove.length, 'old sessions');
      }
    } catch (e) {
      console.warn('[AppKit] Error clearing sessions:', e);
    }
  }

  // Load AppKit CDN script
  async loadCDN() {
    if (this.cdnLoaded || window.AppKit) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.8.14/dist/appkit.js';
      script.onload = () => {
        this.cdnLoaded = true;
        console.log('[AppKit] CDN loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load AppKit CDN'));
      document.head.appendChild(script);
    });
  }

  async initialize() {
    if (this.isInitialized) return this.modal;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('[AppKit] Initializing Reown AppKit...');

      // Import from CDN
      const AppKitModule = await import('https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.8.14/dist/appkit.js');
      const { createAppKit, WagmiAdapter } = AppKitModule;

      console.log('[AppKit] CDN module loaded:', Object.keys(AppKitModule));

      // Create Wagmi adapter (required for WalletConnect)
      const wagmiAdapter = new WagmiAdapter({
        projectId: WALLETCONNECT_PROJECT_ID,
        networks: [confluxEspace]
      });

      // Create AppKit modal with full configuration
      this.modal = createAppKit({
        adapters: [wagmiAdapter],
        networks: [confluxEspace],
        defaultNetwork: confluxEspace,
        metadata,
        projectId: WALLETCONNECT_PROJECT_ID,
        // Featured wallets shown at top (mobile wallets)
        featuredWalletIds: FEATURED_WALLET_IDS,
        // Show all wallets option
        allWallets: 'SHOW',
        // WalletConnect - ENABLED (this is what we need for mobile!)
        enableWalletConnect: true,
        // Disable injected wallet detection - we handle MetaMask/Fluent through our own modal
        enableInjected: false,
        enableEIP6963: false,
        enableCoinbase: false,
        // Features
        features: {
          analytics: false,  // Disable analytics to avoid 403 errors on pulse.walletconnect.org
          email: false,
          socials: false,
          swaps: false,
          onramp: false
        },
        // Theme
        themeMode: document.documentElement.getAttribute('data-theme') || 'light',
        themeVariables: {
          '--w3m-accent': '#38A1D8',
          '--w3m-border-radius-master': '8px'
        }
      });

      console.log('[AppKit] Modal created, checking platform...');
      console.log('[AppKit] User Agent:', navigator.userAgent);
      console.log('[AppKit] Is Mobile:', /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

      // Subscribe to state changes (including modal open/close)
      if (this.modal.subscribeState) {
        this.modal.subscribeState((state) => {
          console.log('[AppKit] State changed:', state);

          // Check if modal was closed without connecting
          if (state.open === false && this._isWaitingForConnection && !this.address) {
            console.log('[AppKit] Modal closed without connection, dispatching cancel');
            this._dispatchDisconnectedEvent();
          }
        });
      }

      // Subscribe to account changes
      if (this.modal.subscribeAccount) {
        this.modal.subscribeAccount((account) => {
          console.log('[AppKit] Account changed:', account);

          // Don't dispatch events if modal is not actively waiting for connection
          if (!this._isWaitingForConnection) {
            console.log('[AppKit] Not waiting for connection, ignoring account change');
            return;
          }

          const newAddress = account?.address || null;

          // Only dispatch events if address actually changed
          if (newAddress === this._lastAddress) {
            console.log('[AppKit] Address unchanged, skipping event');
            return;
          }

          const previousAddress = this._lastAddress;
          this._lastAddress = newAddress;

          if (newAddress) {
            console.log('[AppKit] New address connected:', newAddress);
            this.address = newAddress;
            this._dispatchConnectedEvent(newAddress);
          } else if (previousAddress) {
            // Only dispatch disconnect if we had an address before
            console.log('[AppKit] Address disconnected, previous was:', previousAddress);
            this.address = null;
            this._dispatchDisconnectedEvent();
          } else {
            console.log('[AppKit] Ignoring null->null transition');
          }
        });
      }

      this.isInitialized = true;
      console.log('[AppKit] Initialized successfully');

      return this.modal;
    } catch (error) {
      console.error('[AppKit] Initialization error:', error);
      this.initPromise = null;
      throw error;
    }
  }

  async open() {
    // Clear old WalletConnect sessions to prevent "Connection declined" errors
    this.clearOldSessions();

    await this.initialize();

    // Reset tracking state for fresh connection
    this._lastAddress = null;
    this._isWaitingForConnection = true;  // Enable event dispatching

    if (this.modal?.open) {
      console.log('[AppKit] Opening modal for WalletConnect...');
      // Open directly to Connect view - will show QR code and wallet list
      // Injected wallets are disabled, so only WalletConnect options will show
      this.modal.open({ view: 'Connect' });
    }
  }

  // Call this when connection flow is complete (success or cancel)
  stopWaitingForConnection() {
    this._isWaitingForConnection = false;
  }

  async openNetworks() {
    await this.initialize();
    if (this.modal?.open) {
      this.modal.open({ view: 'Networks' });
    }
  }

  async disconnect() {
    console.log('[AppKit] Disconnecting...');
    this._isWaitingForConnection = false;  // Stop listening for events

    if (this.modal?.disconnect) {
      await this.modal.disconnect();
    }
    this.address = null;
    this.provider = null;
    this._lastAddress = null;

    // Clear old sessions on disconnect
    this.clearOldSessions();
    console.log('[AppKit] Disconnected and sessions cleared');
  }

  getAddress() {
    return this.address;
  }

  async getProvider() {
    await this.initialize();
    if (this.modal?.getWalletProvider) {
      return this.modal.getWalletProvider();
    }
    return null;
  }

  isConnected() {
    return this.modal?.getIsConnected?.() || false;
  }

  /**
   * Get connected wallet info (name and icon)
   * @returns {{ name: string, icon: string } | null}
   */
  getWalletInfo() {
    if (!this.modal?.getWalletInfo) return null;
    try {
      const info = this.modal.getWalletInfo();
      console.log('[AppKit] Wallet info:', info);
      return info;
    } catch (e) {
      console.warn('[AppKit] Failed to get wallet info:', e);
      return null;
    }
  }

  _dispatchConnectedEvent(address) {
    // Get wallet info to include in event
    const walletInfo = this.getWalletInfo();
    console.log('[AppKit] Dispatching connected event:', address, 'wallet:', walletInfo);
    window.dispatchEvent(new CustomEvent('appkit:connected', {
      detail: {
        address,
        walletName: walletInfo?.name || 'WalletConnect',
        walletIcon: walletInfo?.icon || null
      }
    }));
  }

  _dispatchDisconnectedEvent() {
    console.log('[AppKit] Dispatching disconnected event');
    window.dispatchEvent(new CustomEvent('appkit:disconnected'));
  }
}

// Singleton instance
export const appKitService = new AppKitService();

// Also export class for testing
export { AppKitService };
