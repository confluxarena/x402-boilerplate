// Enhanced Wallet Service with EIP-6963 support for Fluent Wallet
import { WALLET_TYPES, WALLET_INFO, getInstalledWallets, isWalletInstalled } from '../config/wallets.js';
import { CONFLUX_NETWORKS } from '../config/networks.js';
import { Web3Service } from './web3Service.js';
import { StorageService } from './storageService.js';

export class WalletService {
  constructor() {
    this.web3Service = new Web3Service();
    this.currentAccount = null;
    this.currentWalletType = null;
    this.walletConnectProvider = null;
    this.provider = null;

    // EIP-6963 providers storage
    this.eip6963Providers = new Map();

    // Initialize EIP-6963 listener
    this.initEIP6963();
  }

  // ============================================
  // EIP-6963 SUPPORT (Modern Wallet Detection)
  // ============================================

  /**
   * Initialize EIP-6963 provider detection
   * This is the modern standard for wallet detection
   */
  initEIP6963() {
    if (typeof window === 'undefined') return;

    // Listen for EIP-6963 announcements
    window.addEventListener('eip6963:announceProvider', (event) => {
      const { info, provider } = event.detail;
      console.log('[EIP-6963] Provider announced:', info.name);
      console.log('[EIP-6963] Provider details:', {
        name: info.name,
        rdns: info.rdns,
        uuid: info.uuid,
        icon: info.icon
      });

      // CRITICAL DEBUG: Check if provider is same object as window.ethereum
      if (info.name === 'Fluent' || info.rdns?.includes('fluent')) {
        console.log('[EIP-6963] 🔍 FLUENT PROVIDER ANALYSIS:');
        console.log('[EIP-6963]   provider === window.ethereum:', provider === window.ethereum);
        console.log('[EIP-6963]   provider === window.conflux:', provider === window.conflux);
        console.log('[EIP-6963]   provider.isFluent:', provider.isFluent);
        console.log('[EIP-6963]   provider.isMetaMask:', provider.isMetaMask);
        console.log('[EIP-6963]   provider.isConflux:', provider.isConflux);
        console.log('[EIP-6963]   typeof provider.request:', typeof provider.request);
      }

      // Store provider info
      this.eip6963Providers.set(info.uuid, {
        info,
        provider
      });
    });

    // Request all providers to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // Debug: Log all providers after 1 second
    setTimeout(() => {
      console.log('[EIP-6963] Total providers detected:', this.eip6963Providers.size);
      for (const [uuid, { info }] of this.eip6963Providers.entries()) {
        console.log('[EIP-6963] Available:', info.name, '| RDNS:', info.rdns);
      }
    }, 1000);
  }

  /**
   * Get Fluent Wallet provider using EIP-6963 (DEX UI approach with relaxed matching)
   */
  getFluentProviderEIP6963() {
    // Check EIP-6963 providers first (modern way)
    for (const [uuid, { info, provider }] of this.eip6963Providers.entries()) {
      console.log('[EIP-6963] Checking provider:', info.name, 'RDNS:', info.rdns);

      // Fluent Wallet identifiers (relaxed matching like DEX UI)
      if (
        info.name?.toLowerCase().includes('fluent') ||
        info.rdns?.toLowerCase().includes('fluent') ||  // ← Relaxed matching!
        info.rdns?.toLowerCase().includes('conflux') ||  // ← Additional check
        provider.isFluent ||
        provider.isConflux
      ) {
        console.log('[EIP-6963] ✅ Found Fluent via EIP-6963:', info.name, '| RDNS:', info.rdns);
        return provider;
      }
    }

    console.log('[EIP-6963] ✗ Fluent not found in EIP-6963 providers');
    return null;
  }

  /**
   * Get MetaMask provider using EIP-6963 (STRICT matching - excludes Fluent)
   * This is critical when multiple wallets are installed since Fluent sets isMetaMask: true
   */
  getMetaMaskProviderEIP6963() {
    for (const [uuid, { info, provider }] of this.eip6963Providers.entries()) {
      console.log('[MetaMask EIP-6963] Checking provider:', info.name, 'RDNS:', info.rdns);

      // STRICT check: only io.metamask RDNS
      // This ensures we get the real MetaMask, not Fluent pretending to be MetaMask
      if (info.rdns === 'io.metamask') {
        console.log('[MetaMask EIP-6963] ✅ Found MetaMask via EIP-6963:', info.name);
        return provider;
      }
    }

    console.log('[MetaMask EIP-6963] ✗ MetaMask not found in EIP-6963 providers');
    return null;
  }

  /**
   * Detect Fluent Wallet (with EIP-6963 support)
   */
  detectFluentWallet() {
    // 1. Try EIP-6963 first (modern standard)
    const eip6963Provider = this.getFluentProviderEIP6963();
    if (eip6963Provider) {
      console.log('[Fluent] Detected via EIP-6963');
      return true;
    }

    // 2. Check conflux object (Core Space)
    if (typeof window.conflux !== 'undefined' && window.conflux.isConflux) {
      console.log('[Fluent] Detected via window.conflux');
      return true;
    }

    // 3. Check ethereum.providers array
    if (window.ethereum?.providers) {
      const hasFluentInProviders = window.ethereum.providers.some(p =>
        p.isConflux || p.isFluent || p.isFluentWallet
      );
      if (hasFluentInProviders) {
        console.log('[Fluent] Detected in ethereum.providers');
        return true;
      }
    }

    // 4. Check window.ethereum directly
    if (window.ethereum && (
      window.ethereum.isConflux ||
      window.ethereum.isFluent ||
      window.ethereum.isFluentWallet
    )) {
      console.log('[Fluent] Detected via window.ethereum');
      return true;
    }

    console.log('[Fluent] Not detected');
    return false;
  }

  /**
   * Get Fluent provider (with EIP-6963 support, preferring eSpace)
   */
  getFluentProvider(preferSpace = 'e') {
    // IMPORTANT: For eSpace, Fluent Wallet uses window.ethereum
    // When multiple wallets installed (MetaMask + Fluent), use EIP-6963 to get correct provider!
    // Priority for eSpace: EIP-6963 (most reliable) > ethereum.providers > window.ethereum

    console.log('[Fluent] Debug - window.ethereum exists:', !!window.ethereum);
    console.log('[Fluent] Debug - window.conflux exists:', !!window.conflux);
    console.log('[Fluent] Debug - window.ethereum.providers:', window.ethereum?.providers);
    console.log('[Fluent] Debug - Is Array?', Array.isArray(window.ethereum?.providers));
    console.log('[Fluent] ⭐ PRIORITY CONNECTION CHECK:', {
      'window.ethereum.isFluent': window.ethereum?.isFluent,
      'window.ethereum.isConflux': window.ethereum?.isConflux,
      'window.ethereum.isMetaMask': window.ethereum?.isMetaMask,
      'Priority Connection enabled?': !!(window.ethereum?.isFluent || window.ethereum?.isConflux)
    });

    // 1. For eSpace (default), prioritize window.ethereum.providers for UI popup support
    if (preferSpace === 'e') {
      // FIRST: Check ethereum.providers array (best for interactive requests with UI)
      if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
        console.log('[Fluent] Searching in ethereum.providers array:', window.ethereum.providers.length, 'providers');

        // DEBUG: Log all providers with their properties
        window.ethereum.providers.forEach((p, index) => {
          console.log(`[Fluent] Provider [${index}]:`, {
            isMetaMask: p.isMetaMask,
            isFluent: p.isFluent,
            isFluentWallet: p.isFluentWallet,
            isConflux: p.isConflux,
            isCoinbaseWallet: p.isCoinbaseWallet,
            constructor: p.constructor?.name
          });
        });

        const fluentProvider = window.ethereum.providers.find(p => {
          const isFluentProvider =
            p.isFluent ||
            p.isFluentWallet ||
            p.isConflux ||
            p._metamask?.isFluent ||  // Sometimes stored in _metamask object
            (p.constructor?.name && p.constructor.name.includes('Fluent'));

          if (isFluentProvider) {
            console.log('[Fluent] Found matching provider:', {
              isFluent: p.isFluent,
              isFluentWallet: p.isFluentWallet,
              isConflux: p.isConflux,
              constructor: p.constructor?.name
            });
          }

          return isFluentProvider;
        });

        if (fluentProvider) {
          console.log('[Fluent] ✓ Found Fluent in ethereum.providers array (priority for UI)');
          return fluentProvider;
        } else {
          console.log('[Fluent] ✗ Fluent NOT found in ethereum.providers array');
        }
      }

      // SECOND: Try window.conflux (Fluent's native provider - SHOWS UI POPUP!)
      if (window.conflux && typeof window.conflux.request === 'function') {
        if (window.conflux.isConflux || window.conflux.isFluent) {
          console.log('[Fluent] ✓ Using window.conflux for eSpace (native Fluent provider with UI)');
          return window.conflux;
        }
      }

      // THIRD: Try EIP-6963 (detection works, but may not show UI popup)
      const eip6963Provider = this.getFluentProviderEIP6963();
      if (eip6963Provider) {
        console.log('[Fluent] Using EIP-6963 provider (fallback, may not show UI)');
        return eip6963Provider;
      }

      // FOURTH: Use window.ethereum directly (only if it's confirmed Fluent)
      if (window.ethereum && typeof window.ethereum.request === 'function') {
        if (window.ethereum.isFluent || window.ethereum.isFluentWallet) {
          console.log('[Fluent] Using window.ethereum (confirmed Fluent)');
          return window.ethereum;
        }
      }

      console.log('[Fluent] ✗ No Fluent provider found for eSpace');
      return null;
    }

    // For Core Space, prefer window.conflux
    if (preferSpace === 'core') {
      if (window.conflux && window.conflux.isConflux) {
        console.log('[Fluent] Using window.conflux for Core Space');
        return window.conflux;
      }
    }

    console.log('[Fluent] No provider found');
    return null;
  }

  /**
   * Get list of installed wallets
   */
  getInstalledWallets() {
    return getInstalledWallets();
  }

  // ============================================
  // WALLET CONNECTION METHODS
  // ============================================

  /**
   * Connect MetaMask
   * Uses EIP-6963 first to correctly identify MetaMask even when Fluent is installed
   * (Fluent sets isMetaMask: true for compatibility, causing conflicts)
   */
  async connectMetaMask(showPrompt = true) {
    console.log('[MetaMask] Starting connection process...');

    // 1. Try EIP-6963 first (most reliable for multi-wallet scenarios)
    let ethereum = this.getMetaMaskProviderEIP6963();

    if (ethereum) {
      console.log('[MetaMask] ✅ Found via EIP-6963');
    } else {
      console.log('[MetaMask] EIP-6963 not available, trying fallbacks...');

      // 2. Try providers array (EXCLUDE Fluent-like wallets)
      if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
        ethereum = window.ethereum.providers.find(p =>
          p.isMetaMask && !p.isFluent && !p.isConflux && !p.isFluentWallet
        );
        if (ethereum) {
          console.log('[MetaMask] ✅ Found in ethereum.providers[] (excluding Fluent)');
        }
      }

      // 3. Last resort: window.ethereum (only if definitely not Fluent)
      if (!ethereum && window.ethereum?.isMetaMask) {
        if (!window.ethereum.isFluent && !window.ethereum.isConflux && !window.ethereum.isFluentWallet) {
          ethereum = window.ethereum;
          console.log('[MetaMask] ✅ Using window.ethereum (verified not Fluent)');
        } else {
          console.log('[MetaMask] ✗ window.ethereum has Fluent flags, cannot use');
        }
      }
    }

    if (!ethereum) {
      throw new Error(`MetaMask is not installed or not accessible. If you have Fluent Wallet installed, MetaMask may be blocked. Please install MetaMask from ${WALLET_INFO[WALLET_TYPES.METAMASK].downloadUrl}`);
    }

    const accounts = showPrompt
      ? await ethereum.request({ method: 'eth_requestAccounts' })
      : await ethereum.request({ method: 'eth_accounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('Failed to access account. Please grant access in MetaMask.');
    }

    this.web3Service.initialize(ethereum);
    this.currentAccount = accounts[0];
    this.currentWalletType = WALLET_TYPES.METAMASK;
    this.provider = ethereum;

    console.log('[MetaMask] ✅ Connected to account:', this.currentAccount);
    StorageService.saveWalletConnection(WALLET_TYPES.METAMASK, this.currentAccount);

    return { account: this.currentAccount, provider: ethereum };
  }

  /**
   * Connect Fluent Wallet (HYBRID APPROACH - EIP-6963 for detection, window.conflux for UI!)
   */
  async connectFluent(showPrompt = true) {
    console.log('[Fluent] Starting connection process...');
    console.log('[Fluent] === DEBUG INFO ===');
    console.log('[Fluent] window.conflux exists:', !!window.conflux);
    console.log('[Fluent] window.conflux.request:', typeof window.conflux?.request);
    console.log('[Fluent] window.conflux.isConflux:', window.conflux?.isConflux);
    console.log('[Fluent] window.conflux.isFluent:', window.conflux?.isFluent);
    console.log('[Fluent] window.conflux.isMetaMask:', window.conflux?.isMetaMask);
    console.log('[Fluent] window.ethereum exists:', !!window.ethereum);
    console.log('[Fluent] window.ethereum.isFluent:', window.ethereum?.isFluent);
    console.log('[Fluent] window.ethereum.isConflux:', window.ethereum?.isConflux);
    console.log('[Fluent] window.ethereum.isMetaMask:', window.ethereum?.isMetaMask);
    console.log('[Fluent] EIP-6963 providers count:', this.eip6963Providers.size);

    // Detect Fluent Wallet
    if (!this.detectFluentWallet()) {
      const errorMsg = `Fluent Wallet is not installed. Please install it from ${WALLET_INFO[WALLET_TYPES.FLUENT].downloadUrl}`;
      console.error('[Fluent]', errorMsg);
      throw new Error(errorMsg);
    }

    // ============================================
    // HYBRID APPROACH - Critical Discovery!
    // ============================================
    // EIP-6963 provider works for DETECTION but does NOT show UI popup!
    // Use window.conflux or window.ethereum for REQUESTS to show popup!

    // Step 1: Check if Fluent is detected via EIP-6963 (for verification)
    const eip6963Provider = this.getFluentProviderEIP6963();
    if (eip6963Provider) {
      console.log('[Fluent] ✅ Detected via EIP-6963 (verified Fluent is installed)');
    }

    // Step 2: Get the CORRECT provider for requests (the one that shows UI popup!)
    // CRITICAL: For eSpace, Fluent uses window.ethereum (NOT window.conflux!)
    // Source: https://docs.fluentwallet.com/espace/
    let requestProvider = null;

    // ====================================================================
    // MULTI-WALLET STRATEGY (FIX #18)
    // ====================================================================
    // When multiple wallets installed (MetaMask + Fluent), we MUST use
    // window.ethereum.providers[] array to get isolated provider!
    //
    // CRITICAL: EIP-6963 provider === window.conflux in Explorer browser,
    // and window.conflux has isMetaMask: true, causing MetaMask to intercept!
    // ====================================================================

    // Priority 0: window.ethereum.providers[] array (MOST RELIABLE for multi-wallet!)
    console.log('[Fluent] Checking Priority 0: ethereum.providers[] (multi-wallet support)...');
    console.log('[Fluent] window.ethereum?.providers exists:', !!window.ethereum?.providers);
    console.log('[Fluent] Is array:', Array.isArray(window.ethereum?.providers));

    if (window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
      console.log('[Fluent] ethereum.providers[] length:', window.ethereum.providers.length);

      // Log all providers in the array
      window.ethereum.providers.forEach((p, index) => {
        console.log(`[Fluent] Provider [${index}]:`, {
          isFluent: p.isFluent,
          isFluentWallet: p.isFluentWallet,
          isConflux: p.isConflux,
          isMetaMask: p.isMetaMask
        });
      });

      const fluentProvider = window.ethereum.providers.find(p =>
        p.isFluent || p.isFluentWallet || p.isConflux
      );

      if (fluentProvider) {
        console.log('[Fluent] ✅ Using provider from ethereum.providers[] (BEST for multi-wallet!)');
        console.log('[Fluent] Selected provider from array:', {
          isFluent: fluentProvider.isFluent,
          isFluentWallet: fluentProvider.isFluentWallet,
          isConflux: fluentProvider.isConflux,
          isMetaMask: fluentProvider.isMetaMask
        });
        requestProvider = fluentProvider;
      } else {
        console.warn('[Fluent] ⚠️ ethereum.providers[] exists but Fluent provider not found in array!');
      }
    } else {
      console.log('[Fluent] ⚠️ ethereum.providers[] not available - will try other methods');
    }

    // Priority 1: EIP-6963 provider (modern standard, but may be same as window.conflux)
    if (!requestProvider && eip6963Provider) {
      console.log('[Fluent] ✅ Using EIP-6963 provider (modern standard)');
      console.log('[Fluent] EIP-6963 provider info:', {
        hasRequestMethod: typeof eip6963Provider.request === 'function',
        isFluent: eip6963Provider.isFluent,
        isConflux: eip6963Provider.isConflux,
        isMetaMask: eip6963Provider.isMetaMask,
        isSameAsConflux: eip6963Provider === window.conflux
      });
      requestProvider = eip6963Provider;
    }

    // Priority 2: window.ethereum with Priority Connection enabled
    if (!requestProvider && window.ethereum && window.ethereum.isFluent) {
      console.log('[Fluent] ✅ Using window.ethereum (Priority Connection enabled)');
      requestProvider = window.ethereum;
    }

    // Priority 3: window.conflux (for Core Space or fallback)
    // WARNING: In Explorer with MetaMask installed, this may trigger MetaMask!
    if (!requestProvider && window.conflux && typeof window.conflux.request === 'function') {
      console.log('[Fluent] ⚠️ Using window.conflux (fallback)');
      console.log('[Fluent] WARNING: In multi-wallet setup, this may trigger wrong wallet!');
      console.log('[Fluent] window.conflux properties:', {
        isFluent: window.conflux.isFluent,
        isConflux: window.conflux.isConflux,
        isMetaMask: window.conflux.isMetaMask
      });
      requestProvider = window.conflux;
    }

    // Final check
    if (!requestProvider) {
      console.error('[Fluent] ❌ No request provider found!');

      // Debug info for troubleshooting
      console.error('[Fluent] Debug - EIP-6963 providers:', this.eip6963Providers);
      for (const [uuid, { info }] of this.eip6963Providers.entries()) {
        console.error('[Fluent] Available provider:', info.name, '| RDNS:', info.rdns);
      }

      // Check if this is a multi-wallet scenario
      const hasMetaMask = window.ethereum?.isMetaMask ||
                         window.ethereum?.providers?.some(p => p.isMetaMask);
      const hasFluent = this.detectFluentWallet();

      if (hasMetaMask && hasFluent) {
        throw new Error(
          '⚠️ Multiple wallets detected (MetaMask + Fluent)\n\n' +
          'To connect Fluent Wallet:\n' +
          '1. Open Fluent Wallet extension\n' +
          '2. Go to Settings → General\n' +
          '3. Enable "Priority Connection"\n' +
          '4. Refresh this page\n\n' +
          'Alternative: Temporarily disable MetaMask extension'
        );
      }

      throw new Error(
        '⚠️ Unable to find Fluent Wallet provider\n\n' +
        'Please check:\n' +
        '1. Fluent Wallet extension is installed and enabled\n' +
        '2. Fluent Wallet is unlocked\n' +
        '3. Try refreshing the page'
      );
    }

    console.log('[Fluent] ✅ Request provider selected:', requestProvider);
    console.log('[Fluent] Provider info:', {
      isFluent: requestProvider.isFluent,
      isConflux: requestProvider.isConflux,
      isMetaMask: requestProvider.isMetaMask,
      constructor: requestProvider.constructor?.name
    });

    // ====================================================================
    // MULTI-WALLET DETECTION AND USER GUIDANCE
    // ====================================================================
    // Check if both MetaMask and Fluent are installed
    const hasMetaMask = window.ethereum?.isMetaMask ||
                       window.ethereum?.providers?.some(p => p.isMetaMask && !p.isFluent);
    const hasFluentInProviders = window.ethereum?.providers?.some(p =>
      p.isFluent || p.isFluentWallet || p.isConflux
    );

    if (hasMetaMask && hasFluentInProviders && requestProvider === window.conflux) {
      console.warn('[Fluent] ⚠️ MULTI-WALLET SCENARIO DETECTED!');
      console.warn('[Fluent] Both MetaMask and Fluent are installed.');
      console.warn('[Fluent] Using window.conflux fallback - this may trigger MetaMask instead!');
      console.warn('[Fluent] ');
      console.warn('[Fluent] RECOMMENDED SOLUTION:');
      console.warn('[Fluent] 1. Open Fluent Wallet → Settings → General');
      console.warn('[Fluent] 2. Enable "Priority Connection"');
      console.warn('[Fluent] 3. Refresh this page');
      console.warn('[Fluent] ');
      console.warn('[Fluent] ALTERNATIVE: Temporarily disable MetaMask extension');
    } else if (hasMetaMask && hasFluentInProviders) {
      console.log('[Fluent] ✅ Multi-wallet setup detected, using isolated provider from ethereum.providers[]');
      console.log('[Fluent] This should work correctly without Priority Connection!');
    }

    // Helper function to add timeout to promises
    const withTimeout = (promise, timeoutMs = 60000) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout - please check Fluent Wallet extension')), timeoutMs)
        )
      ]);
    };

    let accounts;
    try {
      console.log('[Fluent] Requesting accounts from Fluent Wallet...');
      console.log('[Fluent] Request provider properties:', {
        isFluent: requestProvider.isFluent,
        isConflux: requestProvider.isConflux,
        isMetaMask: requestProvider.isMetaMask,
        request: typeof requestProvider.request
      });

      // Request accounts using the selected provider
      const methodUsed = showPrompt ? 'eth_requestAccounts' : 'eth_accounts';
      console.log(`[Fluent] Using ${methodUsed} (eSpace method)...`);
      console.log('[Fluent] showPrompt:', showPrompt);

      // ====================================================================
      // FIX #17: EXPERIMENTAL HACK - Temporarily hide window.ethereum
      // ====================================================================
      try {
        console.log('[Fluent] About to call requestProvider.request()...');

        const accountsPromise = requestProvider.request({ method: methodUsed });
        accounts = await withTimeout(accountsPromise, 60000);

      } catch (innerError) {
        throw innerError;
      }

      console.log('[Fluent] ✅ Response received!');
      console.log('[Fluent] Accounts received:', accounts);

      // Verify this is a Fluent address (basic check)
      if (accounts && accounts.length > 0) {
        console.log('[Fluent] ✓ Successfully connected');
        console.log('[Fluent] ✓ Account:', accounts[0]);

        // CRITICAL: Verify we connected to Fluent and not MetaMask accidentally
        // This can happen if MetaMask intercepted the request
        if (requestProvider === window.conflux && requestProvider.isMetaMask) {
          console.warn('[Fluent] ⚠️ WARNING: Connected via window.conflux which has isMetaMask: true');
          console.warn('[Fluent] Cannot definitively verify this is Fluent and not MetaMask!');
          console.warn('[Fluent] If wrong wallet connected, enable Priority Connection in Fluent settings');
        } else if (requestProvider.isFluent || requestProvider.isConflux) {
          console.log('[Fluent] ✅ Verified: Provider has Fluent identifier');
        }
      }
    } catch (requestError) {
      console.error('[Fluent] Account request error:', requestError);

      if (requestError.message?.includes('timeout')) {
        // Check if ConfluxPortal is installed (causes conflicts)
        const hasConfluxPortalError = window.performance?.getEntriesByType?.('resource')
          ?.some(r => r.name.includes('portal-inpage.js'));

        let errorMsg = 'Connection timeout. Please make sure Fluent Wallet extension is unlocked and check for pending requests.';

        if (hasConfluxPortalError || requestError.message?.includes('read only property')) {
          errorMsg += '\n\n⚠️ CONFLICT DETECTED: Old ConfluxPortal extension is installed.\n' +
                      'ConfluxPortal conflicts with Fluent Wallet.\n\n' +
                      'Solution: Disable or remove the old ConfluxPortal extension, then refresh the page.';
        }

        throw new Error(errorMsg);
      } else if (requestError.code === 4001) {
        throw new Error('Connection rejected by user.');
      } else if (requestError.code === -32002) {
        throw new Error('Connection request already pending. Please check Fluent Wallet.');
      } else {
        throw new Error(`Failed to request accounts: ${requestError.message}`);
      }
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in Fluent Wallet.');
    }

    // Initialize Web3 service with the request provider
    this.web3Service.initialize(requestProvider);
    this.currentAccount = accounts[0];
    this.currentWalletType = WALLET_TYPES.FLUENT;
    this.provider = requestProvider;

    console.log('[Fluent] Connected to account:', this.currentAccount);

    // Check and switch to Conflux eSpace Mainnet if needed
    if (showPrompt) {
      try {
        console.log('[Fluent] Checking chain ID...');

        // Helper function to add timeout to promises
        const withTimeout = (promise, timeoutMs = 5000) => {
          return Promise.race([
            promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
            )
          ]);
        };

        // Get chain ID with timeout (5 seconds max)
        const chainId = await withTimeout(this.web3Service.getChainId(), 5000);
        console.log('[Fluent] Current chain ID:', chainId);

        // Conflux eSpace Mainnet = 1030 (0x406)
        if (chainId !== 1030 && chainId !== '0x406') {
          console.log('[Fluent] Switching to Conflux eSpace Mainnet...');
          await withTimeout(this.web3Service.switchNetwork(requestProvider, CONFLUX_NETWORKS.eSpace), 5000);
        }
      } catch (chainError) {
        console.warn('[Fluent] Chain check/switch warning:', chainError);
        console.warn('[Fluent] ⚠️ Skipping chain check - continuing with connection');
        // Don't throw error, just warn - user can manually switch
      }
    }

    // Save connection
    StorageService.saveWalletConnection(WALLET_TYPES.FLUENT, this.currentAccount);

    console.log('[Fluent] Connection successful!');
    return { account: this.currentAccount, provider: requestProvider };
  }

  /**
   * Get OKX Wallet provider via EIP-6963
   */
  getOKXProviderEIP6963() {
    for (const [uuid, { info, provider }] of this.eip6963Providers.entries()) {
      console.log('[OKX EIP-6963] Checking provider:', info.name, 'RDNS:', info.rdns);

      // OKX Wallet identifiers
      if (
        info.name?.toLowerCase().includes('okx') ||
        info.rdns?.toLowerCase().includes('okx') ||
        info.rdns?.toLowerCase().includes('okex') ||
        provider.isOkxWallet ||
        provider.isOKExWallet ||
        provider.isOkx
      ) {
        console.log('[OKX EIP-6963] ✅ Found OKX via EIP-6963:', info.name, '| RDNS:', info.rdns);
        return provider;
      }
    }

    console.log('[OKX EIP-6963] ✗ OKX not found in EIP-6963 providers');
    return null;
  }

  /**
   * Check if running on mobile device
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Connect OKX Wallet
   * On desktop: uses browser extension (window.okxwallet)
   * On mobile: uses WalletConnect (OKX app can scan QR code)
   */
  async connectOKX(showPrompt = true) {
    console.log('[OKX] Starting connection process...');
    console.log('[OKX] Is mobile device:', this.isMobileDevice());
    console.log('[OKX] === DEBUG INFO ===');
    console.log('[OKX] window.okxwallet:', typeof window.okxwallet);

    // On mobile, OKX Wallet extension is not available
    // Use WalletConnect instead - OKX app supports WalletConnect QR scanning
    if (this.isMobileDevice() && typeof window.okxwallet === 'undefined') {
      console.log('[OKX] Mobile device detected, OKX extension not available');
      console.log('[OKX] Redirecting to WalletConnect (OKX app can scan QR code)');

      // Use WalletConnect - OKX Wallet app supports scanning QR codes
      return await this.connectWalletConnect();
    }

    // Desktop detection
    console.log('[OKX] window.ethereum:', typeof window.ethereum);
    console.log('[OKX] window.ethereum?.isOkxWallet:', window.ethereum?.isOkxWallet);
    console.log('[OKX] EIP-6963 providers count:', this.eip6963Providers.size);

    // List all EIP-6963 providers for debugging
    for (const [uuid, { info }] of this.eip6963Providers.entries()) {
      console.log('[OKX] EIP-6963 provider available:', info.name, '| RDNS:', info.rdns);
    }

    // Check if OKX extension is installed
    const isInstalled = typeof window.okxwallet !== 'undefined' ||
                        window.ethereum?.isOkxWallet ||
                        window.ethereum?.providers?.some(p => p.isOkxWallet);

    if (!isInstalled) {
      throw new Error(`OKX Wallet is not installed. Please install it from ${WALLET_INFO[WALLET_TYPES.OKX].downloadUrl}`);
    }

    // Find OKX provider - check multiple locations in priority order
    let provider = null;

    // 0. Try EIP-6963 first (modern standard)
    const eip6963Provider = this.getOKXProviderEIP6963();
    if (eip6963Provider) {
      console.log('[OKX] ✅ Found via EIP-6963');
      provider = eip6963Provider;
    }

    // 1. Check window.okxwallet (dedicated OKX provider - official method)
    if (!provider && window.okxwallet) {
      console.log('[OKX] ✅ Found window.okxwallet (official)');
      provider = window.okxwallet;
    }

    // 2. Check ethereum.providers array (multi-wallet setup)
    if (!provider && window.ethereum?.providers && Array.isArray(window.ethereum.providers)) {
      const okxProvider = window.ethereum.providers.find(p => p.isOkxWallet);
      if (okxProvider) {
        console.log('[OKX] ✅ Found OKX in ethereum.providers[]');
        provider = okxProvider;
      }
    }

    // 3. Check window.ethereum directly
    if (!provider && window.ethereum?.isOkxWallet) {
      console.log('[OKX] ✅ Found OKX as window.ethereum');
      provider = window.ethereum;
    }

    if (!provider) {
      console.error('[OKX] ❌ No provider found!');
      throw new Error('OKX Wallet provider not found. Please make sure the extension is enabled and refresh the page.');
    }

    console.log('[OKX] Using provider:', {
      isOkxWallet: provider.isOkxWallet,
      constructor: provider.constructor?.name
    });

    try {
      const accounts = showPrompt
        ? await provider.request({ method: 'eth_requestAccounts' })
        : await provider.request({ method: 'eth_accounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('Failed to access account in OKX Wallet.');
      }

      this.web3Service.initialize(provider);
      this.currentAccount = accounts[0];
      this.currentWalletType = WALLET_TYPES.OKX;
      this.provider = provider;

      console.log('[OKX] ✅ Connected successfully:', this.currentAccount);
      StorageService.saveWalletConnection(WALLET_TYPES.OKX, this.currentAccount);

      return { account: this.currentAccount, provider };
    } catch (error) {
      console.error('[OKX] Connection error:', error);
      if (error.code === 4001) {
        throw new Error('Connection rejected by user.');
      } else if (error.code === -32002) {
        throw new Error('Connection request already pending. Please check OKX Wallet.');
      }
      throw error;
    }
  }

  /**
   * Connect Halo Wallet
   */
  async connectHalo(showPrompt = true) {
    if (!isWalletInstalled(WALLET_TYPES.HALO)) {
      throw new Error(`Halo Wallet is not installed. Please install it from ${WALLET_INFO[WALLET_TYPES.HALO].downloadUrl}`);
    }

    const provider = window.halo || window.ethereum;

    const accounts = showPrompt
      ? await provider.request({ method: 'eth_requestAccounts' })
      : await provider.request({ method: 'eth_accounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('Failed to access account in Halo Wallet.');
    }

    this.web3Service.initialize(provider);
    this.currentAccount = accounts[0];
    this.currentWalletType = WALLET_TYPES.HALO;
    this.provider = provider;

    StorageService.saveWalletConnection(WALLET_TYPES.HALO, this.currentAccount);

    return { account: this.currentAccount, provider };
  }

  /**
   * Connect TokenPocket Wallet
   */
  async connectTokenPocket(showPrompt = true) {
    if (!isWalletInstalled(WALLET_TYPES.TOKENPOCKET)) {
      throw new Error(`TokenPocket is not installed. Please install it from ${WALLET_INFO[WALLET_TYPES.TOKENPOCKET].downloadUrl}`);
    }

    // TokenPocket uses ethereum provider
    const provider = window.ethereum;

    if (!provider.isTokenPocket) {
      throw new Error('TokenPocket provider not found.');
    }

    const accounts = showPrompt
      ? await provider.request({ method: 'eth_requestAccounts' })
      : await provider.request({ method: 'eth_accounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('Failed to access account in TokenPocket.');
    }

    this.web3Service.initialize(provider);
    this.currentAccount = accounts[0];
    this.currentWalletType = WALLET_TYPES.TOKENPOCKET;
    this.provider = provider;

    StorageService.saveWalletConnection(WALLET_TYPES.TOKENPOCKET, this.currentAccount);

    return { account: this.currentAccount, provider };
  }

  /**
   * Connect Coinbase Wallet
   */
  async connectCoinbase(showPrompt = true) {
    if (!isWalletInstalled(WALLET_TYPES.COINBASE)) {
      throw new Error(`Coinbase Wallet is not installed. Please install it from ${WALLET_INFO[WALLET_TYPES.COINBASE].downloadUrl}`);
    }

    let provider = window.ethereum;

    // Handle multiple providers
    if (window.ethereum.providers) {
      provider = window.ethereum.providers.find(p => p.isCoinbaseWallet);
    }

    const accounts = showPrompt
      ? await provider.request({ method: 'eth_requestAccounts' })
      : await provider.request({ method: 'eth_accounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('Failed to access account in Coinbase Wallet.');
    }

    this.web3Service.initialize(provider);
    this.currentAccount = accounts[0];
    this.currentWalletType = WALLET_TYPES.COINBASE;
    this.provider = provider;

    StorageService.saveWalletConnection(WALLET_TYPES.COINBASE, this.currentAccount);

    return { account: this.currentAccount, provider };
  }

  /**
   * Connect Trust Wallet
   */
  async connectTrust(showPrompt = true) {
    if (!isWalletInstalled(WALLET_TYPES.TRUST)) {
      throw new Error(`Trust Wallet is not installed. Please install it from ${WALLET_INFO[WALLET_TYPES.TRUST].downloadUrl}`);
    }

    const provider = window.ethereum;

    if (!provider.isTrust) {
      throw new Error('Trust Wallet provider not found.');
    }

    const accounts = showPrompt
      ? await provider.request({ method: 'eth_requestAccounts' })
      : await provider.request({ method: 'eth_accounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('Failed to access account in Trust Wallet.');
    }

    this.web3Service.initialize(provider);
    this.currentAccount = accounts[0];
    this.currentWalletType = WALLET_TYPES.TRUST;
    this.provider = provider;

    StorageService.saveWalletConnection(WALLET_TYPES.TRUST, this.currentAccount);

    return { account: this.currentAccount, provider };
  }

  /**
   * Connect WalletConnect v2 via Reown AppKit
   * Opens the AppKit modal with QR code and wallet list
   */
  async connectWalletConnect(showPrompt = true) {
    try {
      console.log('[WalletConnect] Starting connection via Reown AppKit, showPrompt:', showPrompt);

      // Dynamic import of AppKit service
      const { appKitService } = await import('./appkitService.js');

      // Initialize AppKit with retry logic
      let initRetries = 3;
      while (initRetries > 0) {
        try {
          await appKitService.initialize();
          break;
        } catch (initError) {
          initRetries--;
          console.warn('[WalletConnect] Init failed, retries left:', initRetries);
          if (initRetries === 0) throw initError;
          // Clear sessions and retry
          appKitService.clearOldSessions();
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // Silent reconnect mode - check if already connected without showing modal
      if (!showPrompt) {
        console.log('[WalletConnect] Silent reconnect mode - checking existing session...');

        // Check if already connected
        if (appKitService.isConnected()) {
          const address = appKitService.getAddress();
          if (address) {
            console.log('[WalletConnect] Found existing session:', address);

            // Get provider
            let provider = null;
            try {
              provider = await appKitService.getProvider();
            } catch (e) {
              console.warn('[WalletConnect] Could not get provider:', e);
            }

            // Get wallet info
            const walletInfo = appKitService.getWalletInfo();

            this.walletConnectProvider = provider;
            this.currentAccount = address;
            this.currentWalletType = WALLET_TYPES.WALLETCONNECT;
            this.provider = provider;
            this.connectedWalletInfo = {
              name: walletInfo?.name || 'WalletConnect',
              icon: walletInfo?.icon || null
            };

            if (provider) {
              this.web3Service.initialize(provider);
            }

            return {
              account: this.currentAccount,
              provider: this.walletConnectProvider,
              walletInfo: this.connectedWalletInfo
            };
          }
        }

        // No existing session - throw error instead of showing modal
        throw new Error('No existing WalletConnect session. Please connect manually.');
      }

      // Return a promise that resolves when wallet is connected
      return new Promise((resolve, reject) => {
        let resolved = false;

        const cleanup = () => {
          window.removeEventListener('appkit:connected', handleConnected);
          window.removeEventListener('appkit:disconnected', handleDisconnected);
          // Stop AppKit from dispatching more events
          appKitService.stopWaitingForConnection();
        };

        // Listen for connection event
        const handleConnected = async (event) => {
          if (resolved) return;
          resolved = true;
          cleanup();

          const address = event.detail.address;
          const walletName = event.detail.walletName;
          const walletIcon = event.detail.walletIcon;
          console.log('[WalletConnect] Connected via AppKit:', address, 'wallet:', walletName);

          // Get provider from AppKit with timeout
          let provider = null;
          try {
            const providerPromise = appKitService.getProvider();
            const timeoutPromise = new Promise((_, rej) =>
              setTimeout(() => rej(new Error('Provider timeout')), 10000)
            );
            provider = await Promise.race([providerPromise, timeoutPromise]);
          } catch (providerError) {
            console.warn('[WalletConnect] Provider fetch failed:', providerError);
            // Continue without provider - we still have the address
          }

          this.walletConnectProvider = provider;
          this.currentAccount = address;
          this.currentWalletType = WALLET_TYPES.WALLETCONNECT;
          this.provider = provider;

          // Store connected wallet info for display
          this.connectedWalletInfo = {
            name: walletName || 'WalletConnect',
            icon: walletIcon || null
          };

          // Initialize web3 service
          if (provider) {
            this.web3Service.initialize(provider);
          }

          StorageService.saveWalletConnection(WALLET_TYPES.WALLETCONNECT, this.currentAccount, this.connectedWalletInfo);

          resolve({
            account: this.currentAccount,
            provider: this.walletConnectProvider,
            walletInfo: this.connectedWalletInfo
          });
        };

        // Listen for disconnect/cancel event
        const handleDisconnected = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          reject(new Error('Connection cancelled by user.'));
        };

        window.addEventListener('appkit:connected', handleConnected);
        window.addEventListener('appkit:disconnected', handleDisconnected);

        // Open the AppKit modal
        appKitService.open();

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(new Error('Connection timeout. Please try again.'));
          }
        }, 300000);
      });
    } catch (error) {
      console.error('[WalletConnect] Connection error:', error);
      throw new Error(`WalletConnect connection failed: ${error.message}`);
    }
  }

  /**
   * Universal connect method - connects to any supported wallet
   */
  async connect(walletType, showPrompt = true) {
    switch (walletType) {
      case WALLET_TYPES.METAMASK:
        return await this.connectMetaMask(showPrompt);
      case WALLET_TYPES.FLUENT:
        return await this.connectFluent(showPrompt);
      case WALLET_TYPES.OKX:
        return await this.connectOKX(showPrompt);
      case WALLET_TYPES.HALO:
        return await this.connectHalo(showPrompt);
      case WALLET_TYPES.TOKENPOCKET:
        return await this.connectTokenPocket(showPrompt);
      case WALLET_TYPES.COINBASE:
        return await this.connectCoinbase(showPrompt);
      case WALLET_TYPES.TRUST:
        return await this.connectTrust(showPrompt);
      case WALLET_TYPES.WALLETCONNECT:
        return await this.connectWalletConnect(showPrompt);
      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }

  // ============================================
  // WALLET MANAGEMENT
  // ============================================

  /**
   * Reconnect to a previously connected wallet
   * @param {string} walletType - Type of wallet to reconnect
   * @param {string} expectedAddress - Expected wallet address
   * @returns {Promise<{account: string, provider: any}>}
   */
  async reconnect(walletType, expectedAddress) {
    console.log(`[WalletService] Attempting to reconnect ${walletType}...`);

    try {
      const result = await this.connect(walletType, false);

      // Verify address matches
      if (result.account.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new Error(`Address mismatch: expected ${expectedAddress}, got ${result.account}`);
      }

      console.log(`[WalletService] ✅ Successfully reconnected ${walletType}`);
      return result;
    } catch (error) {
      console.error(`[WalletService] ❌ Failed to reconnect ${walletType}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    if (this.currentWalletType === WALLET_TYPES.WALLETCONNECT) {
      try {
        // Use AppKit service for proper WalletConnect v2 disconnect
        const { appKitService } = await import('./appkitService.js');
        await appKitService.disconnect();
      } catch (error) {
        console.error('Error disconnecting WalletConnect:', error);
      }
      this.walletConnectProvider = null;
    }

    this.web3Service.clear();
    this.currentAccount = null;
    this.currentWalletType = null;
    this.provider = null;

    StorageService.clearWalletConnection();
  }

  /**
   * Check if wallet is connected
   */
  isConnected() {
    return this.currentAccount !== null && this.currentWalletType !== null;
  }

  // ============================================
  // GETTERS
  // ============================================

  getCurrentAccount() {
    return this.currentAccount;
  }

  getCurrentWalletType() {
    return this.currentWalletType;
  }

  getProvider() {
    return this.provider;
  }

  getWeb3Service() {
    return this.web3Service;
  }

  /**
   * Get wallet info for current wallet
   */
  getCurrentWalletInfo() {
    if (!this.currentWalletType) return null;
    return WALLET_INFO[this.currentWalletType];
  }
}
