// Conflux Network Configuration
export const CONFLUX_NETWORKS = {
  eSpace: {
    chainId: '0x406', // 1030 in hex
    chainName: 'Conflux eSpace',
    nativeCurrency: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18
    },
    rpcUrls: ['https://evm.confluxrpc.com'],
    blockExplorerUrls: ['https://evm.confluxscan.io']
  },
  eSpaceTestnet: {
    chainId: '0x47', // 71 in hex
    chainName: 'Conflux eSpace Testnet',
    nativeCurrency: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18
    },
    rpcUrls: ['https://evmtestnet.confluxrpc.com'],
    blockExplorerUrls: ['https://evmtestnet.confluxscan.io']
  },
  coreSpace: {
    chainId: '0x405', // 1029 in hex
    chainName: 'Conflux Core Space',
    nativeCurrency: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18
    },
    rpcUrls: ['https://main.confluxrpc.com'],
    blockExplorerUrls: ['https://confluxscan.io']
  },
  coreSpaceTestnet: {
    chainId: '0x1', // 1 in hex
    chainName: 'Conflux Core Space (Testnet)',
    nativeCurrency: {
      name: 'Conflux',
      symbol: 'CFX',
      decimals: 18
    },
    rpcUrls: ['https://test.confluxrpc.com'],
    blockExplorerUrls: ['https://testnet.confluxscan.io']
  }
};
