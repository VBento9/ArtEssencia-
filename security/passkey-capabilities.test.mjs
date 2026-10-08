import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./passkey-capabilities.js', import.meta.url), 'utf8')
  .replace('export async function inspectPasskeyCapabilities()', 'async function inspectPasskeyCapabilities()');
function load(overrides = {}) {
  const context = vm.createContext({ ...overrides });
  vm.runInContext(source + '\nthis.inspect = inspectPasskeyCapabilities;', context);
  return context.inspect;
}
test('sem contexto seguro não disponibiliza autenticação', async () => {
  const result = await load({ isSecureContext: false, PublicKeyCredential: class {} })();
  assert.equal(result.readyForRegistration, false);
  assert.equal(result.platformAuthenticatorAvailable, false);
});
test('sem WebAuthn não disponibiliza autenticação', async () => {
  const result = await load({ isSecureContext: true })();
  assert.equal(result.webAuthnAvailable, false);
});
test('deteta autenticador sem ativar registo', async () => {
  class PublicKeyCredential {
    static async isUserVerifyingPlatformAuthenticatorAvailable() { return true; }
    static async isConditionalMediationAvailable() { return true; }
  }
  const result = await load({ isSecureContext: true, PublicKeyCredential })();
  assert.equal(result.platformAuthenticatorAvailable, true);
  assert.equal(result.conditionalMediationAvailable, true);
  assert.equal(result.readyForRegistration, false);
});
test('falhas das APIs não interrompem a aplicação', async () => {
  class PublicKeyCredential {
    static async isUserVerifyingPlatformAuthenticatorAvailable() { throw Error('blocked'); }
    static async isConditionalMediationAvailable() { throw Error('blocked'); }
  }
  const result = await load({ isSecureContext: true, PublicKeyCredential })();
  assert.equal(result.platformAuthenticatorAvailable, false);
  assert.equal(result.conditionalMediationAvailable, false);
});
