// Web3 Service
import { CONFLUX_NETWORKS } from '../config/networks.js';

export class Web3Service {
  constructor() {
    this.web3 = null;
    this.provider = null;
  }

  // Initialize Web3 with provider
  initialize(provider) {
    console.log('[Web3Service] Initializing with provider:', provider);
    this.provider = provider; // Store provider for direct RPC calls
    this.web3 = new Web3(provider);
    return this.web3;
  }

  // Get current instance
  getInstance() {
    return this.web3;
  }

  // Get balance (with fallback to direct RPC)
  async getBalance(address) {
    if (!this.web3) throw new Error('Web3 not initialized');

    console.log('[Web3Service] Getting balance for:', address);

    // Try direct RPC call first (works better with Fluent)
    if (this.provider && typeof this.provider.request === 'function') {
      try {
        console.log('[Web3Service] Trying direct RPC: eth_getBalance');
        const balanceHex = await this.provider.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        });
        console.log('[Web3Service] Balance hex:', balanceHex);

        // Convert hex to decimal using Web3.js utils
        const balance = this.web3.utils.fromWei(balanceHex, 'ether');
        console.log('[Web3Service] Balance converted:', balance);
        return balance;
      } catch (rpcError) {
        console.warn('[Web3Service] Direct RPC failed, trying Web3.js:', rpcError);
        // Fallback to Web3.js method
        const balance = await this.web3.eth.getBalance(address);
        return this.web3.utils.fromWei(balance, 'ether');
      }
    }

    // Fallback to standard Web3.js
    const balance = await this.web3.eth.getBalance(address);
    return this.web3.utils.fromWei(balance, 'ether');
  }

  // Get chain ID (with fallback to direct RPC)
  async getChainId() {
    if (!this.web3) throw new Error('Web3 not initialized');

    console.log('[Web3Service] Getting chain ID...');

    // Try direct RPC call first (works better with Fluent)
    if (this.provider && typeof this.provider.request === 'function') {
      try {
        console.log('[Web3Service] Trying direct RPC: eth_chainId');
        const chainIdHex = await this.provider.request({
          method: 'eth_chainId',
          params: []
        });
        console.log('[Web3Service] Chain ID hex:', chainIdHex);

        // Convert hex to decimal
        const chainId = parseInt(chainIdHex, 16);
        console.log('[Web3Service] Chain ID converted:', chainId);
        return chainId;
      } catch (rpcError) {
        console.warn('[Web3Service] Direct RPC failed, trying Web3.js:', rpcError);
        // Fallback to Web3.js method
        return await this.web3.eth.getChainId();
      }
    }

    // Fallback to standard Web3.js
    return await this.web3.eth.getChainId();
  }

  // Get network name from chain ID
  getNetworkName(chainId) {
    switch (chainId) {
      case 1030:
        return 'Conflux eSpace';
      case 71:
        return 'Conflux eSpace (Testnet)';
      case 1029:
        return 'Conflux Core Space';
      case 1:
        return 'Conflux Core Space (Testnet)';
      default:
        return `Chain ID: ${chainId}`;
    }
  }

  // Check if chain is Conflux network
  isConfluxNetwork(chainId) {
    return (
      chainId === parseInt(CONFLUX_NETWORKS.eSpace.chainId, 16) ||
      chainId === parseInt(CONFLUX_NETWORKS.eSpaceTestnet.chainId, 16) ||
      chainId === parseInt(CONFLUX_NETWORKS.coreSpace.chainId, 16) ||
      chainId === parseInt(CONFLUX_NETWORKS.coreSpaceTestnet.chainId, 16)
    );
  }

  // Request to switch network
  async switchNetwork(provider, network) {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: network.chainId }]
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        // Network not added, try to add it
        await this.addNetwork(provider, network);
        return true;
      }
      throw error;
    }
  }

  // Add network to wallet
  async addNetwork(provider, network) {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [network]
    });
  }

  // Clear instance
  clear() {
    this.web3 = null;
    this.provider = null;
  }
}
