/**
 * x402 V2 Client Service for PayFi Escrow
 *
 * Handles the x402 payment flow:
 * 1. Request → 402 + PAYMENT-REQUIRED
 * 2. Parse requirements
 * 3. Sign EIP-3009 transferWithAuthorization
 * 4. Retry with PAYMENT-SIGNATURE
 * 5. Parse PAYMENT-RESPONSE
 *
 * @package x402-boilerplate
 * @version 1.0.0
 * @since 2026-02-03
 */

class X402Service {
  constructor() {
    this.network = 'eip155:1030';
    this.x402Version = 2;
  }

  /**
   * Pay for a resource using x402 V2 protocol
   * @param {string} url - The URL to request
   * @param {object} options - Fetch options
   * @param {object} signer - ethers.js Signer (from connected wallet)
   * @returns {Promise<Response>}
   */
  async payAndFetch(url, options = {}, signer) {
    // Step 1: Initial request
    const response = await fetch(url, options);

    if (response.status !== 402) {
      return response; // No payment needed
    }

    // Step 2: Parse payment requirements
    const requirementsList = this.parsePaymentRequired(response);
    const requirements = this.selectRequirements(requirementsList);

    if (!requirements) {
      throw new Error('No compatible payment requirements found');
    }

    // Step 3: Sign EIP-3009 authorization
    const paymentPayload = await this.signPayment(requirements, signer);

    // Step 4: Retry with payment
    const paidResponse = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'PAYMENT-SIGNATURE': this.encodePayload(paymentPayload),
      },
    });

    // Step 5: Parse PAYMENT-RESPONSE if present
    const paymentResponse = paidResponse.headers.get('PAYMENT-RESPONSE');
    if (paymentResponse) {
      paidResponse.x402Response = JSON.parse(atob(paymentResponse));
    }

    return paidResponse;
  }

  /**
   * Parse PAYMENT-REQUIRED header into requirements array
   */
  parsePaymentRequired(response) {
    const header = response.headers.get('PAYMENT-REQUIRED');
    if (!header) throw new Error('Missing PAYMENT-REQUIRED header');
    return JSON.parse(atob(header));
  }

  /**
   * Select compatible requirements (eip3009 on eip155:1030)
   */
  selectRequirements(requirementsList) {
    return requirementsList.find(r =>
      r.scheme === 'exact' &&
      r.network === this.network &&
      (r.extra?.settlementMode === 'transfer' || r.extra?.assetTransferMethod === 'eip3009')
    );
  }

  /**
   * Sign EIP-3009 transferWithAuthorization for payment
   */
  async signPayment(requirements, signer) {
    const address = await signer.getAddress();

    // Generate random nonce for EIP-3009
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    // EIP-712 typed data for transferWithAuthorization
    // name and version come from the requirements.extra (server provides them)
    const domain = {
      name: requirements.extra.name,
      version: requirements.extra.version,
      chainId: 1030,
      verifyingContract: requirements.asset,
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    const message = {
      from: address,
      to: requirements.payTo,      // X402EscrowAdapter address
      value: requirements.amount,   // amount + fee
      validAfter: String(validAfter),
      validBefore: String(validBefore),
      nonce,
    };

    const signature = await signer.signTypedData(domain, types, message);

    return {
      x402Version: this.x402Version,
      scheme: 'exact',
      network: this.network,
      payload: {
        signature,
        authorization: message,
      },
    };
  }

  /**
   * Encode payload as base64
   */
  encodePayload(payload) {
    return btoa(JSON.stringify(payload));
  }
}

export const x402Service = new X402Service();
