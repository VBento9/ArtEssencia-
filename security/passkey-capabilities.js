/**
 * Deteção de capacidades apenas. Não cria credenciais, não inicia sessão
 * e não modifica a interface, a base de dados ou o service worker.
 * Importar explicitamente apenas numa futura interface experimental.
 */
export async function inspectPasskeyCapabilities() {
  const result = {
    secureContext: typeof isSecureContext === 'boolean' && isSecureContext,
    webAuthnAvailable: typeof PublicKeyCredential !== 'undefined',
    platformAuthenticatorAvailable: false,
    conditionalMediationAvailable: false,
    readyForRegistration: false,
  };

  if (!result.secureContext || !result.webAuthnAvailable) return result;

  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      result.platformAuthenticatorAvailable =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    result.platformAuthenticatorAvailable = false;
  }

  try {
    if (typeof PublicKeyCredential.isConditionalMediationAvailable === 'function') {
      result.conditionalMediationAvailable =
        await PublicKeyCredential.isConditionalMediationAvailable();
    }
  } catch {
    result.conditionalMediationAvailable = false;
  }

  // A existência de um autenticador não comprova que o backend valida WebAuthn.
  // Registo e autenticação continuam deliberadamente desativados.
  return result;
}
