import { readDeliveryZoneConfig, prepareDeliveryZoneConfig } from './zone-config.mjs';

// Editor opt-in: não é montado automaticamente nem grava na Cloud.
// Um integrador deve fornecer explicitamente onSave(config), após validar as permissões.
export function mountDeliveryZoneEditor(root, shopDelivery, { onSave } = {}) {
  if (!root || typeof root.replaceChildren !== 'function') throw new Error('invalid editor root');
  if (typeof onSave !== 'function') throw new Error('save callback required');
  let state = readDeliveryZoneConfig(shopDelivery);
  const el = (tag, value = '') => { const n = document.createElement(tag); if(value) n.textContent = value; return n; };
  const field = (label, initial, onChange, type = 'text') => {
    const wrapper = el('label'); wrapper.style.display='block';
    const caption = el('span',label); wrapper.append(caption);
    const input = document.createElement('input');input.type=type;input.value=String(initial ?? '');
    input.addEventListener('input',()=>onChange(input.value));
    wrapper.append(input);return wrapper;
  };
  const render = () => {
    root.replaceChildren();
    const title = el('h3','Zonas de entrega (pré-configuração)');root.append(title);
    root.append(el('p','Sede: Castelejo. Os dados só são guardados após confirmação explícita. A ativação comercial requer validação do checkout.'));
    const list = el('div');
    state.zones.forEach((z, i) => {
      const item = el('fieldset');
      item.append(field('Localidade',z.name,v=>{state.zones[i].name=v}));
      item.append(field('Portes (€)',(z.feeCents/100).toFixed(2),v=>{
        const clean=v.trim().replace(',','.');
        const n=Number(clean);
        state.zones[i].feeCents=clean !== '' && /^\d+(?:\.\d{1,2})?$/.test(clean) && Number.isSafeInteger(Math.round(n*100)) ? Math.round(n*100) : NaN;
      }));
      item.append(field('Códigos postais completos, separados por vírgula',z.postalCodes.join(', '),v=>{
        state.zones[i].postalCodes=v.split(',').map(s=>s.trim()).filter(Boolean);
      }));
      const enabled = el('label','Ativa');const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=z.enabled;
      checkbox.addEventListener('change',()=>{state.zones[i].enabled=checkbox.checked}); enabled.prepend(checkbox);item.append(enabled);
      const remove=el('button','Remover localidade');remove.type='button';remove.addEventListener('click',()=>{state.zones.splice(i,1);render()});item.append(remove);
      list.append(item);
    });
    root.append(list);
    const add=el('button','Adicionar localidade');add.type='button';
    add.addEventListener('click',()=>{state.zones.push({name:'',enabled:false,feeCents:0,postalCodes:[]});render()});root.append(add);
    const error=el('p');error.setAttribute('role','alert');root.append(error);
    const save=el('button','Guardar pré-configuração');save.type='button';
    save.addEventListener('click',async ()=>{
      if (save.disabled) return;
      try {
        // Durante a integração esta configuração permanece desativada.
        const validated=prepareDeliveryZoneConfig({...state,enabled:false});
        save.disabled=true;
        await onSave(validated);
        error.textContent='Pré-configuração guardada. Zonas não ativadas na Loja.';
      } catch (e) {error.textContent=e?.message || 'Não foi possível guardar';}
      finally {save.disabled=false;}
    });
    root.append(save);
  };
  render();
  return { getDraft:()=>structuredClone(state), unmount:()=>root.replaceChildren() };
}
