import { computeDeliveryQuote } from './delivery-quote.mjs';
import { evaluateDeliveryDateTime } from './delivery-calendar.mjs';

// Contrato isolado. Apenas o servidor pode fornecer produtos, desconto e configuracao.
// Nao cria clientes, encomendas nem escreve na base de dados.
export function evaluateTrustedDeliveryCheckout({request,server,nowISO}) {
  if (!request || !server || !Array.isArray(request.items) || !request.items.length) throw new Error('invalid order');
  if (server.storeStatus?.mode !== 'open' || server.storeStatus.enabled !== true || server.storeStatus.accepting_orders !== true) return {accepted:false,reason:'store_not_accepting_orders'};
  if (request.fulfillment !== 'ENTREGA') return {accepted:false,reason:'not_delivery'};
  const products = new Map(server.products.map(p=>[String(p.id),p]));
  let subtotalCents=0;
  for (const line of request.items) {
    const product = products.get(String(line.product_id));
    if (!product || product.active !== true || product.available !== true) return {accepted:false,reason:'product_unavailable'};
    if (!Number.isSafeInteger(line.quantity) || line.quantity<1 || line.quantity>1000 || !Number.isSafeInteger(product.priceCents) || product.priceCents<0) return {accepted:false,reason:'invalid_item'};
    const sum=product.priceCents*line.quantity;
    if (!Number.isSafeInteger(sum) || !Number.isSafeInteger(subtotalCents+sum)) throw new Error('total overflow');
    subtotalCents+=sum;
  }
  const date=evaluateDeliveryDateTime({nowISO,deliveryDate:request.deliveryDate,deliveryTime:request.deliveryTime,leadHours:server.preparationHours??48});
  if (!date.eligible) return {accepted:false,reason:date.reason};
  const quote=computeDeliveryQuote({postalCode:request.postalCode,shopDelivery:server.shopDelivery,subtotalCents});
  if (!quote.eligible) return {accepted:false,reason:quote.reason};
  if (!Number.isSafeInteger(server.discountCents??0) || (server.discountCents??0)<0) throw new Error('invalid server discount');
  const discountCents=Math.min(server.discountCents??0,subtotalCents);
  return {accepted:true,subtotalCents,feeCents:quote.feeCents,discountCents,totalCents:quote.totalCents-discountCents,locality:quote.locality,postalCode:quote.postalCode,deliveryDate:request.deliveryDate,deliveryTime:request.deliveryTime};
}
