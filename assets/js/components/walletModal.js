// Wallet Modal Component
export class WalletModal {
  constructor() {
    this.modal = document.getElementById('wallet-modal');

    // Skip initialization if modal doesn't exist on this page
    if (!this.modal) {
      this.initialized = false;
      return;
    }

    this.initialized = true;
    this.modalContainer = this.modal.querySelector('.modal-container');
    this.closeModalButton = document.getElementById('close-modal');
    this.closeConnectedModalButton = document.getElementById('close-connected-modal');

    // Modal sections
    this.walletOptions = document.getElementById('wallet-options');
    this.connectedState = document.getElementById('connected-state');
    this.connectionStatus = document.getElementById('connection-status');
    this.loadingState = document.getElementById('loading');
    this.errorState = document.getElementById('error');

    // Text elements
    this.loadingText = document.getElementById('loading-text');
    this.errorMessage = document.getElementById('error-message');

    this.init();
  }

  init() {
    if (!this.initialized) return;

    // Close button listeners
    if (this.closeModalButton) {
      this.closeModalButton.addEventListener('click', () => this.close());
    }
    if (this.closeConnectedModalButton) {
      this.closeConnectedModalButton.addEventListener('click', () => this.close());
    }

    // Dismiss error
    const dismissError = document.getElementById('dismiss-error');
    if (dismissError) {
      dismissError.addEventListener('click', () => this.hideError());
    }

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  open() {
    if (!this.initialized) return;
    // Reset to show wallet options (not connected state)
    this.reset();
    this.modal.classList.remove('hidden');
    setTimeout(() => {
      this.modal.classList.add('active');
      if (this.modalContainer) {
        this.modalContainer.classList.add('active');
      }
    }, 10);
  }

  close() {
    if (!this.initialized) return;
    this.modal.classList.remove('active');
    if (this.modalContainer) {
      this.modalContainer.classList.remove('active');
    }
    setTimeout(() => {
      this.modal.classList.add('hidden');
      this.reset();
    }, 300);
  }

  reset() {
    if (!this.initialized) return;
    if (this.walletOptions) this.walletOptions.classList.remove('hidden');
    if (this.connectedState) this.connectedState.classList.add('hidden');
    if (this.connectionStatus) this.connectionStatus.classList.add('hidden');
    if (this.loadingState) this.loadingState.classList.add('hidden');
    if (this.errorState) this.errorState.classList.add('hidden');
  }

  showLoading(message = 'Connecting...') {
    if (!this.initialized) return;
    if (this.walletOptions) this.walletOptions.classList.add('hidden');
    if (this.connectedState) this.connectedState.classList.add('hidden');
    if (this.connectionStatus) this.connectionStatus.classList.remove('hidden');
    if (this.loadingState) this.loadingState.classList.remove('hidden');
    if (this.errorState) this.errorState.classList.add('hidden');
    if (this.loadingText) this.loadingText.textContent = message;
  }

  hideLoading() {
    if (!this.initialized) return;
    if (this.connectionStatus) this.connectionStatus.classList.add('hidden');
    if (this.loadingState) this.loadingState.classList.add('hidden');
  }

  showError(message) {
    if (!this.initialized) return;
    if (this.walletOptions) this.walletOptions.classList.add('hidden');
    if (this.connectedState) this.connectedState.classList.add('hidden');
    if (this.connectionStatus) this.connectionStatus.classList.remove('hidden');
    if (this.loadingState) this.loadingState.classList.add('hidden');
    if (this.errorState) this.errorState.classList.remove('hidden');
    if (this.errorMessage) this.errorMessage.textContent = message;
  }

  hideError() {
    if (!this.initialized) return;
    if (this.connectionStatus) this.connectionStatus.classList.add('hidden');
    if (this.errorState) this.errorState.classList.add('hidden');
    if (this.walletOptions) this.walletOptions.classList.remove('hidden');
  }

  showConnected() {
    if (!this.initialized) return;
    if (this.walletOptions) this.walletOptions.classList.add('hidden');
    if (this.connectedState) this.connectedState.classList.remove('hidden');
    this.hideLoading();
  }
}
