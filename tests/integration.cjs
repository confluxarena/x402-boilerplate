#!/usr/bin/env node
/**
 * x402 Boilerplate — Integration Tests
 *
 * Validates file paths, cross-file consistency, security, and project quality.
 * No external dependencies — runs with Node.js built-in modules only.
 *
 * Usage:
 *   npm test
 *   node tests/integration.cjs
 *
 * @package x402-boilerplate
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

let errors = 0;
let ok = 0;

function pass(msg) { console.log('  \x1b[32mPASS\x1b[0m  ' + msg); ok++; }
function fail(msg) { console.error('  \x1b[31mFAIL\x1b[0m  ' + msg); errors++; }

// ============================================
// 1. JS Import Paths
// ============================================

console.log('\n=== 1. JS Import Paths ===');
const jsImports = [
  ['assets/js/services/walletService.js', '../config/wallets.js'],
  ['assets/js/services/walletService.js', '../config/networks.js'],
  ['assets/js/services/walletService.js', './web3Service.js'],
  ['assets/js/services/walletService.js', './storageService.js'],
  ['assets/js/services/web3Service.js', '../config/networks.js'],
];
jsImports.forEach(function(pair) {
  var resolved = path.join(path.dirname(pair[0]), pair[1]);
  fs.existsSync(resolved) ? pass(pair[0] + ' -> ' + pair[1]) : fail(pair[0] + ' -> ' + pair[1]);
});

// ============================================
// 2. HTML Imports
// ============================================

console.log('\n=== 2. HTML Imports ===');
['assets/js/services/walletService.js', 'assets/js/services/x402Service.js', 'assets/js/config/wallets.js'].forEach(function(f) {
  fs.existsSync(f) ? pass('demo.html -> ' + f) : fail('demo.html -> ' + f);
});

// ============================================
// 3. PHP require_once Paths
// ============================================

console.log('\n=== 3. PHP require_once Paths ===');
['api/x402/ai.php', 'api/x402/ai-demo-proxy.php', 'api/config/database.php'].forEach(function(f) {
  var content = fs.readFileSync(f, 'utf-8');
  var lines = content.split('\n');
  lines.forEach(function(line) {
    var match = line.match(/require_once\s+__DIR__\s*\.\s*['"]([^'"]+)['"]/);
    if (match) {
      var rel = match[1];
      var fixedRel = rel.startsWith('/') ? '.' + rel : rel;
      var resolved = path.resolve(path.dirname(f), fixedRel);
      fs.existsSync(resolved) ? pass(f + ' -> ' + rel) : fail(f + ' -> ' + rel + ' (resolved: ' + resolved + ')');
    }
  });
});

// ============================================
// 4. .env.example Variables
// ============================================

console.log('\n=== 4. .env.example Variables ===');
var envContent = fs.readFileSync('.env.example', 'utf-8');
['DB_PGSQL_HOST','DB_PGSQL_PORT','DB_PGSQL_NAME','DB_PGSQL_USER','DB_PGSQL_PASS',
 'ARENA_SIGNER_PRIVATE_KEY','X402_API_TREASURY','X402_FACILITATOR_KEY',
 'CLAUDE_API_KEY','CLAUDE_MODEL','X402_API_PRICE','DEMO_BUYER_KEY',
 'API_URL','APP_URL','X402_FACILITATOR_PORT'].forEach(function(v) {
  envContent.includes(v) ? pass('.env.example has ' + v) : fail('.env.example missing ' + v);
});

// ============================================
// 5. Cross-file Consistency
// ============================================

console.log('\n=== 5. Cross-file Consistency ===');
var fac = fs.readFileSync('facilitator/x402-facilitator.cjs', 'utf-8');
var ai = fs.readFileSync('api/x402/ai.php', 'utf-8');
var x402svc = fs.readFileSync('assets/js/services/x402Service.js', 'utf-8');
var demo = fs.readFileSync('x402-demo.html', 'utf-8');
var agent = fs.readFileSync('agent/x402-ai-agent-demo.cjs', 'utf-8');

// USDT0 address
var usdt0 = '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff';
(fac.includes(usdt0) && ai.includes(usdt0)) ? pass('USDT0 address consistent') : fail('USDT0 address mismatch');

// Network
(fac.includes('eip155:1030') && ai.includes('eip155:1030') && x402svc.includes('eip155:1030') && demo.includes('eip155:1030'))
  ? pass('Network eip155:1030 consistent (4 files)') : fail('Network mismatch');

// Port
fac.includes("'3849'") ? pass('Facilitator port 3849') : fail('Port mismatch');

// EIP-712 types - TransferWithAuthorization fields
var eip712Fields = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'];
var allHaveFields = [fac, x402svc, demo, agent].every(function(content) {
  return eip712Fields.every(function(field) { return content.includes(field); });
});
allHaveFields ? pass('EIP-712 TransferWithAuthorization fields consistent') : fail('EIP-712 fields mismatch');

// settlementMode check
(x402svc.includes('settlementMode') && ai.includes('settlementMode') && fac.includes('settlementMode'))
  ? pass('settlementMode field consistent') : fail('settlementMode mismatch');

// API headers
['PAYMENT-REQUIRED', 'PAYMENT-SIGNATURE'].forEach(function(h) {
  var count = [fac, ai, demo, agent, x402svc].filter(function(c) { return c.includes(h); }).length;
  count >= 3 ? pass(h + ' header in ' + count + ' files') : fail(h + ' header only in ' + count + ' files');
});

// ============================================
// 6. Security Checks
// ============================================

console.log('\n=== 6. Security Checks ===');
var dockerCompose = fs.readFileSync('docker-compose.yml', 'utf-8');
fac.includes("127.0.0.1") ? pass('Facilitator binds to localhost') : fail('Facilitator not on localhost');
fs.existsSync('.dockerignore') ? pass('.dockerignore exists') : fail('.dockerignore missing');
var dockerignore = fs.readFileSync('.dockerignore', 'utf-8');
dockerignore.includes('.env') ? pass('.dockerignore excludes .env') : fail('.dockerignore missing .env');
dockerignore.includes('node_modules') ? pass('.dockerignore excludes node_modules') : fail('.dockerignore missing node_modules');
fs.existsSync('.gitignore') ? pass('.gitignore exists') : fail('.gitignore missing');
var gitignore = fs.readFileSync('.gitignore', 'utf-8');
gitignore.includes('.env') ? pass('.gitignore excludes .env') : fail('.gitignore missing .env');
gitignore.includes('node_modules') ? pass('.gitignore excludes node_modules') : fail('.gitignore missing node_modules');

// ============================================
// 7. Project Quality
// ============================================

console.log('\n=== 7. Project Quality ===');
fs.existsSync('LICENSE') ? pass('LICENSE file') : fail('LICENSE missing');
var pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
pkg.license === 'MIT' ? pass('package.json license=MIT') : fail('package.json license');
(pkg.engines && pkg.engines.node) ? pass('package.json engines.node') : fail('package.json engines');
(!pkg.private) ? pass('package.json not private') : fail('package.json private=true');
pkg.repository ? pass('package.json has repository') : fail('package.json no repository');
pkg.scripts && pkg.scripts.test ? pass('package.json has test script') : fail('package.json missing test script');

// Docker checks
dockerCompose.includes('DB_PGSQL_PASS') ? pass('docker-compose uses DB_PGSQL_PASS') : fail('docker-compose password var mismatch');
dockerCompose.includes('npm install') ? pass('docker-compose has npm install') : fail('docker-compose missing npm install');
dockerCompose.includes('env_file') ? pass('docker-compose has env_file') : fail('docker-compose missing env_file');

// No circular dependency
var webDeps = dockerCompose.match(/web:[\s\S]*?depends_on:([\s\S]*?)(?=\n\s*\w|$)/);
var hasCircular = webDeps && webDeps[1] && webDeps[1].includes('facilitator');
(!hasCircular) ? pass('No circular dependency web<->facilitator') : fail('Circular dependency detected');

// Dockerfile printf
var dockerfile = fs.readFileSync('Dockerfile', 'utf-8');
dockerfile.includes('printf') ? pass('Dockerfile uses printf (not echo)') : fail('Dockerfile uses echo');

// Schema
var schema = fs.readFileSync('database/schema.sql', 'utf-8');
['endpoint','payer_address','asset_address','amount','tx_hash','question','answer_length','tokens_used'].forEach(function(col) {
  schema.includes(col) ? pass('Schema has ' + col) : fail('Schema missing ' + col);
});

// ============================================
// 8. No Hardcoded Project-specific URLs
// ============================================

console.log('\n=== 8. No Hardcoded URLs ===');
var filesToCheck = [
  { file: 'assets/js/services/x402Service.js', label: 'x402Service' },
  { file: 'assets/js/services/appkitService.js', label: 'appkitService' },
  { file: 'assets/js/config/wallets.js', label: 'wallets.js' },
  { file: 'agent/x402-ai-agent-demo.cjs', label: 'agent' },
];
filesToCheck.forEach(function(item) {
  var content = fs.readFileSync(item.file, 'utf-8');
  !content.includes('confluxarena.org') ? pass(item.label + ' has no hardcoded confluxarena.org') : fail(item.label + ' has hardcoded confluxarena.org');
});

// ============================================
// 9. EIP-712 Domain Consistency
// ============================================

console.log('\n=== 9. EIP-712 Domain Consistency ===');
// All signers must use the same domain structure
var domainFiles = [fac, agent, x402svc, demo];
var allHaveDomainName = domainFiles.every(function(c) { return c.includes('name:') || c.includes("'name'"); });
var allHaveDomainVersion = domainFiles.every(function(c) { return c.includes('version:') || c.includes("'version'"); });
var allHaveChainId = domainFiles.every(function(c) { return c.includes('chainId:') || c.includes("'chainId'") || c.includes('chainId'); });
var allHaveVerifyingContract = domainFiles.every(function(c) { return c.includes('verifyingContract'); });

allHaveDomainName ? pass('All signers include domain.name') : fail('Missing domain.name');
allHaveDomainVersion ? pass('All signers include domain.version') : fail('Missing domain.version');
allHaveChainId ? pass('All signers include domain.chainId') : fail('Missing domain.chainId');
allHaveVerifyingContract ? pass('All signers include domain.verifyingContract') : fail('Missing domain.verifyingContract');

// Verify chainId 1030 is used consistently
var allUse1030 = domainFiles.every(function(c) { return c.includes('1030'); });
allUse1030 ? pass('ChainId 1030 used in all signing files') : fail('ChainId mismatch in signing files');

// ============================================
// 10. Agent Safety Controls
// ============================================

console.log('\n=== 10. Agent Safety Controls ===');
agent.includes('SPEND_CAP') ? pass('Agent has spending cap') : fail('Agent missing spending cap');
agent.includes('AGENT_SPEND_CAP') ? pass('Agent reads AGENT_SPEND_CAP env var') : fail('Agent missing AGENT_SPEND_CAP env');
agent.includes('totalSpent') ? pass('Agent tracks total spending') : fail('Agent missing spend tracking');
envContent.includes('AGENT_SPEND_CAP') ? pass('.env.example has AGENT_SPEND_CAP') : fail('.env.example missing AGENT_SPEND_CAP');

// ============================================
// 11. CI/CD
// ============================================

console.log('\n=== 11. CI/CD ===');
fs.existsSync('.github/workflows/ci.yml') ? pass('GitHub Actions CI workflow exists') : fail('GitHub Actions CI missing');
var ciContent = fs.readFileSync('.github/workflows/ci.yml', 'utf-8');
ciContent.includes('npm test') ? pass('CI runs npm test') : fail('CI missing npm test');
ciContent.includes('php -l') ? pass('CI runs PHP lint') : fail('CI missing PHP lint');

// ============================================
// RESULTS
// ============================================

console.log('\n========================================');
console.log('  TOTAL: ' + ok + ' passed, ' + errors + ' failed');
console.log('========================================');
if (errors > 0) process.exit(1);
console.log('  ALL TESTS PASSED');
