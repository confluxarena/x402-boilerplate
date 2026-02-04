// Local Storage Service
export const StorageService = {
  // Keys - IMPORTANT: must match AuthService keys!
  KEYS: {
    WALLET_TYPE: 'walletType',
    WALLET_ADDRESS: 'walletAddress',
    WALLET_INFO: 'walletInfo',  // For WalletConnect wallet name/icon
    THEME: 'theme',
    SESSION_TOKEN: 'arena_session_token',  // Matches AuthService
    SESSION_EXPIRES: 'arena_session_expires'
  },

  // Save wallet connection info
  saveWalletConnection(walletType, address, walletInfo = null) {
    localStorage.setItem(this.KEYS.WALLET_TYPE, walletType);
    localStorage.setItem(this.KEYS.WALLET_ADDRESS, address);
    if (walletInfo) {
      // Filter out broken icon URLs before saving
      const cleanedInfo = { ...walletInfo };
      if (cleanedInfo.icon && !this.isValidIconUrl(cleanedInfo.icon)) {
        console.log('[Storage] Not saving broken icon URL:', cleanedInfo.icon);
        cleanedInfo.icon = null;
      }
      localStorage.setItem(this.KEYS.WALLET_INFO, JSON.stringify(cleanedInfo));
    } else {
      localStorage.removeItem(this.KEYS.WALLET_INFO);
    }
  },

  // Known broken icon sources
  BROKEN_ICON_SOURCES: [
    'altcoinsbox.com',
    'placeholder.com',
    'via.placeholder.com'
  ],

  // Check if icon URL is valid
  isValidIconUrl(url) {
    if (!url) return false;
    return !this.BROKEN_ICON_SOURCES.some(source => url.includes(source));
  },

  // Get saved wallet info
  getSavedWalletInfo() {
    let walletInfo = null;
    try {
      const stored = localStorage.getItem(this.KEYS.WALLET_INFO);
      if (stored) {
        walletInfo = JSON.parse(stored);
        // Clean up broken icon URLs
        if (walletInfo?.icon && !this.isValidIconUrl(walletInfo.icon)) {
          console.log('[Storage] Removing broken icon URL:', walletInfo.icon);
          walletInfo.icon = null;
        }
      }
    } catch (e) {}

    return {
      walletType: localStorage.getItem(this.KEYS.WALLET_TYPE),
      address: localStorage.getItem(this.KEYS.WALLET_ADDRESS),
      walletInfo: walletInfo
    };
  },

  // Clear wallet connection info
  clearWalletConnection() {
    localStorage.removeItem(this.KEYS.WALLET_TYPE);
    localStorage.removeItem(this.KEYS.WALLET_ADDRESS);
    localStorage.removeItem(this.KEYS.WALLET_INFO);
    this.clearSession();
  },

  // Theme management
  saveTheme(theme) {
    localStorage.setItem(this.KEYS.THEME, theme);
  },

  getTheme() {
    return localStorage.getItem(this.KEYS.THEME) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  },

  // Session token management
  saveSession(token, expiresAt) {
    console.log('[Storage] Saving session token:', token ? token.substring(0, 8) + '...' : 'null');
    console.log('[Storage] Session expires at:', expiresAt);
    localStorage.setItem(this.KEYS.SESSION_TOKEN, token);
    if (expiresAt) {
      localStorage.setItem(this.KEYS.SESSION_EXPIRES, expiresAt);
    }
  },

  getSessionToken() {
    const token = localStorage.getItem(this.KEYS.SESSION_TOKEN);
    const expires = localStorage.getItem(this.KEYS.SESSION_EXPIRES);

    console.log('[Storage] getSessionToken - token exists:', !!token);
    console.log('[Storage] getSessionToken - expires:', expires);

    // Check if session expired
    if (expires && new Date(expires) < new Date()) {
      console.log('[Storage] Session expired! Clearing...');
      this.clearSession();
      return null;
    }

    if (token) {
      console.log('[Storage] Returning valid session token:', token.substring(0, 8) + '...');
    }
    return token;
  },

  isSessionValid() {
    const token = this.getSessionToken();
    return !!token;
  },

  clearSession() {
    localStorage.removeItem(this.KEYS.SESSION_TOKEN);
    localStorage.removeItem(this.KEYS.SESSION_EXPIRES);
  }
};
