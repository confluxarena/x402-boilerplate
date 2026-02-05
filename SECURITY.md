# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow responsible disclosure:

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to: **security@confluxarena.org**
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested fixes (optional)

### What to Expect

| Timeframe | Action |
|-----------|--------|
| 24 hours | Initial acknowledgment of your report |
| 72 hours | Preliminary assessment and severity rating |
| 7 days | Detailed response with remediation plan |
| 30 days | Target fix deployment for critical issues |

### Safe Harbor

We support safe harbor for security researchers who:
- Act in good faith
- Avoid privacy violations and data destruction
- Do not exploit vulnerabilities beyond proof-of-concept
- Give us reasonable time to respond before disclosure

## Security Measures

### Current Implementations

| Component | Security Measure | Status |
|-----------|-----------------|--------|
| Middleware | EIP-712 signature verification | ✅ Implemented |
| Middleware | Nonce replay protection | ✅ Implemented |
| Middleware | Amount/recipient validation | ✅ Implemented |
| API | Rate limiting ready | ✅ Implemented |
| API | CORS configuration | ✅ Implemented |
| Payments | Direct wallet-to-wallet transfers | ✅ Implemented |
| Payments | No intermediate custody | ✅ Implemented |

### Cryptographic Standards

- **Signature Scheme**: EIP-712 typed data signing
- **Authorization**: EIP-3009 `transferWithAuthorization`
- **Nonce Generation**: Cryptographically secure random 32-byte values
- **Token Support**: USDT0 on Conflux eSpace (verified contract)

## Security Considerations for Implementers

### Environment Variables

```bash
# NEVER commit these to version control
X402_FACILITATOR_KEY=your_private_key  # Keep secure!
```

### Production Checklist

- [ ] Use HTTPS only
- [ ] Set restrictive CORS origins
- [ ] Enable rate limiting
- [ ] Monitor for unusual payment patterns
- [ ] Regularly rotate facilitator keys
- [ ] Keep dependencies updated

### Known Limitations

1. **Signature Expiry**: Payment signatures are valid for 1 hour by default
2. **Network Dependency**: Relies on Conflux eSpace RPC availability
3. **Token Scope**: Currently supports USDT0 only (extensible)

## Audit Status

| Audit Type | Status | Date |
|------------|--------|------|
| Internal Review | ✅ Complete | 2025-12 |
| External Audit | 📋 Planned | TBD |

## Dependencies

We monitor dependencies for known vulnerabilities:

- `ethers.js` - Ethereum library (regularly updated)
- `viem` - Type-safe Ethereum library
- PHP dependencies via Composer

## Contact

- **Security Issues**: security@confluxarena.org
- **General Questions**: [GitHub Discussions](https://github.com/confluxarena/x402-boilerplate/discussions)
