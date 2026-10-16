// ArtEssencia — validação pura da configuração de entregas da Loja.
// Sem chamadas à Cloud e sem escrever na base de dados.
// A UI do Backoffice deverá chamar isto ANTES de guardar.
export function normalizeDeliveryZones(value) {
  if (!Array.isArray(value)) throw new Error('A lista de zonas deve ser válida.');
  const used = new Set();
  return value.map((row, idx) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Zona inválida.');
    const locality = String(row.locality ?? '').trim();
    const active = row.active === true;
    const amount = Number(row.fee_cents);
    const codes = row.postal_codes;
    if (!locality || locality.length > 100) throw new Error('Indica uma localidade válida.');
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000)
      throw new Error('Portes inválidos na zona ' + locality + '.');
    if (!Array.isArray(codes) || !codes.length)
      throw new Error('Indica os códigos postais de ' + locality + '.');
    const normalizedCodes = codes.map(x => {
      const digits = String(x).replace(/\D/g, '');
      if (!/^\d{7}$/.test(digits)) throw new Error('Código postal inválido em ' + locality + '.');
      return digits.slice(0,4) + '-' + digits.slice(4);
    });
    if (new Set(normalizedCodes).size !== normalizedCodes.length)
      throw new Error('Código postal repetido na zona ' + locality + '.');
    if (active) for (const code of normalizedCodes) {
      const key = locality.toLocaleLowerCase('pt-PT') + '|' + code;
      if (used.has(key)) throw new Error('Zona ativa duplicada: ' + locality + ' ' + code + '.');
      used.add(key);
    }
    return { locality, active, postal_codes: normalizedCodes, fee_cents: amount };
  });
}
