/**
 * Adaptador experimental, sem UI e sem ativação automática.
 * Usa apenas sessões emitidas e validadas por Supabase Auth.
 */
export function createPasskeyAdapter({createClient, url, publishableKey, enabled = false}) {
  if (!enabled) return Object.freeze({ enabled: false });
  if (typeof createClient !== 'function') throw new Error('SDK Supabase indisponível.');
  if (!/^https:\/\//.test(url || '') || !publishableKey) throw new Error('Configuração Supabase inválida.');
  const client = createClient(url, publishableKey, {
    auth: { experimental: { passkey: true }, persistSession: false, autoRefreshToken: false },
  });
  if (!client?.auth?.registerPasskey || !client?.auth?.signInWithPasskey) {
    throw new Error('Versão Supabase sem suporte experimental de Passkeys.');
  }
  async function register() {
    const {data: current, error: userError} = await client.auth.getUser();
    if (userError || !current?.user || !current.user.email_confirmed_at && !current.user.phone_confirmed_at)
      throw new Error('É necessário iniciar sessão com uma conta confirmada antes de registar biometria.');
    const {data, error} = await client.auth.registerPasskey();
    if (error) throw error;
    return data;
  }
  async function signIn() {
    const {data, error} = await client.auth.signInWithPasskey();
    if (error) throw error;
    if (!data?.session?.access_token || !data.session.refresh_token || !data?.user?.id)
      throw new Error('O Supabase não devolveu uma sessão válida.');
    return {session:data.session,user:data.user};
  }
  return Object.freeze({enabled:true,register,signIn});
}
