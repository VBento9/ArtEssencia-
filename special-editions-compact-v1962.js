/* ArtEssencia — editor compacto das Edições Especiais (UI apenas).
   Mantém IDs, handlers e payloads Cloud do editor existente. */
(() => {
  'use strict';

  function start() {
    const root = document.getElementById('specialEditions');
    const editor = root?.querySelector('.special-editor-card-v1734');
    const picker = document.getElementById('specialEditionProducts');
    const head = editor?.querySelector('.special-editor-head');
    const productsPanel = editor?.querySelector('.special-products-panel-v1734');
    if (!root || !editor || !picker || !head || !productsPanel || editor.dataset.compactReadyV1962) return;
    editor.dataset.compactReadyV1962 = '1';

    const steps = [
      { id: 'dados', label: 'Dados e publicação', short: 'Dados' },
      { id: 'tema', label: 'Tema, textos e capa', short: 'Tema e capa' },
      { id: 'produtos', label: 'Escolher produtos', short: 'Produtos' }
    ];

    const tabs = document.createElement('nav');
    tabs.className = 'special-compact-tabs-v1962';
    tabs.setAttribute('aria-label', 'Etapas de edição especial');
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'special-compact-tab-v1962';
      button.dataset.step = step.id;
      button.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      button.innerHTML = '<span class="special-tab-number-v1962">' + (i + 1) + '</span><span class="special-tab-label-v1962"></span>';
      button.querySelector('.special-tab-label-v1962').textContent = step.label;
      if (i === 2) {
        const quantity = document.createElement('span');
        quantity.className = 'special-tab-count-v1962';
        quantity.id = 'specialCompactCountV1962';
        quantity.textContent = '0';
        button.append(quantity);
      }
      button.addEventListener('click', () => setStep(step.id));
      tabs.append(button);
    }
    head.after(tabs);

    const tools = document.createElement('div');
    tools.className = 'special-picker-tools-v1962';
    tools.innerHTML = '<label class="special-picker-search-v1962">Pesquisar produto<input id="specialPickerSearchV1962" type="search" autocomplete="off" placeholder="Nome, categoria ou preço…"></label>' +
      '<label class="special-picker-category-v1962">Categoria<select id="specialPickerCategoryV1962"><option value="">Todas</option></select></label>' +
      '<button type="button" id="specialPickerOnlySelectedV1962" class="btn special-only-selected-v1962" aria-pressed="false">Só selecionados</button>' +
      '<div id="specialPickerStatusV1962" class="special-picker-status-v1962" role="status" aria-live="polite"></div>';
    productsPanel.insertBefore(tools, picker);
    const search = document.getElementById('specialPickerSearchV1962');
    const category = document.getElementById('specialPickerCategoryV1962');
    const onlyButton = document.getElementById('specialPickerOnlySelectedV1962');
    const status = document.getElementById('specialPickerStatusV1962');
    const count = document.getElementById('specialCompactCountV1962');
    let onlySelected = false;

    function setStep(id) {
      if (!steps.some(s => s.id === id)) return;
      editor.dataset.specialStepV1962 = id;
      tabs.querySelectorAll('button[data-step]').forEach(button => {
        const active = button.dataset.step === id;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
    }

    function rows() {
      return Array.from(picker.querySelectorAll('.special-product-option'));
    }

    function productInfo(row) {
      const raw = row.querySelector('span small')?.textContent || '';
      const name = row.querySelector('span b')?.textContent || '';
      return { name, category: raw.split(' · Loja')[0].trim(), raw };
    }

    function refreshCategories() {
      const previous = category.value;
      const names = Array.from(new Set(rows().map(row => productInfo(row).category).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'pt-PT'));
      category.replaceChildren(new Option('Todas', ''));
      names.forEach(name => category.add(new Option(name, name)));
      category.value = names.includes(previous) ? previous : '';
    }

    function applyFilters() {
      const query = search.value.trim().toLocaleLowerCase('pt-PT');
      let selected = 0, exclusive = 0, visible = 0;
      const all = rows();
      all.forEach(row => {
        const include = row.querySelector('input[data-role="include"]');
        const checked = !!include?.checked;
        const information = productInfo(row);
        if (checked) {
          selected++;
          if (row.querySelector('input[data-role="exclusive"]')?.checked) exclusive++;
        }
        row.classList.toggle('is-selected-v1962', checked);
        const matchesSearch = !query || (information.name + ' ' + information.raw).toLocaleLowerCase('pt-PT').includes(query);
        const matchesCategory = !category.value || information.category === category.value;
        const shown = matchesSearch && matchesCategory && (!onlySelected || checked);
        row.hidden = !shown;
        row.style.display = shown ? '' : 'none';
        if (shown) visible++;
      });
      count.textContent = String(selected);
      status.textContent = selected + ' selecionado(s)' + (exclusive ? ' · ' + exclusive + ' exclusivo(s)' : '') +
        ' · ' + visible + ' de ' + all.length + ' visíveis';
      picker.classList.toggle('special-no-matches-v1962', all.length > 0 && visible === 0);
      const noMatches = document.getElementById('specialPickerEmptyV1962');
      if (noMatches) noMatches.hidden = visible !== 0 || all.length === 0;
    }

    const empty = document.createElement('div');
    empty.id = 'specialPickerEmptyV1962';
    empty.className = 'special-picker-empty-v1962';
    empty.textContent = 'Nenhum produto corresponde aos filtros. Limpa a pesquisa ou mostra todos.';
    empty.hidden = true;
    picker.after(empty);

    function resetFilters() {
      search.value = '';
      category.value = '';
      onlySelected = false;
      onlyButton.setAttribute('aria-pressed', 'false');
      onlyButton.classList.remove('active');
      refreshCategories();
      applyFilters();
    }

    search.addEventListener('input', applyFilters);
    category.addEventListener('change', applyFilters);
    onlyButton.addEventListener('click', () => {
      onlySelected = !onlySelected;
      onlyButton.setAttribute('aria-pressed', String(onlySelected));
      onlyButton.classList.toggle('active', onlySelected);
      applyFilters();
    });
    picker.addEventListener('change', event => {
      if (event.target?.matches('input[data-role="include"],input[data-role="exclusive"]')) applyFilters();
    });
    new MutationObserver(() => { refreshCategories(); applyFilters(); }).observe(picker, { childList: true });

    root.addEventListener('click', event => {
      const clicked = event.target.closest('button');
      if (!clicked) return;
      const handler = clicked.getAttribute('onclick') || '';
      if (handler.includes('editSpecialEdition(') || handler.includes('clearSpecialEditionForm(')) {
        setStep('dados');
        resetFilters();
      }
    });

    refreshCategories();
    applyFilters();
    setStep('dados');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();