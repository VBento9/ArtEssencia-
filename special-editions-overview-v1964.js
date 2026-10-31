/* ArtEssencia 1.9.64 — Edições guardadas primeiro; editor sob pedido.
   Extensão exclusivamente de apresentação: preserva o DOM de produtos, os seus
   identificadores e todas as chamadas Cloud existentes. */
(() => {
  'use strict';

  function initialise() {
    const root = document.getElementById('specialEditions');
    const editor = root?.querySelector('.special-editor-card-v1734');
    const savedHead = root?.querySelector('.special-saved-head-v1734');
    const savedGrid = document.getElementById('specialEditionsGrid');
    const editorHead = editor?.querySelector('.special-editor-head');
    if (!root || !editor || !savedHead || !savedGrid || !editorHead || root.dataset.savedFirstV1964) return;

    const PAGE_SIZE = 6;
    let limit = PAGE_SIZE;

    // Reordenar os nós existentes mantém os eventos, os dados e as rotinas da Cloud.
    root.insertBefore(savedHead, editor);
    root.insertBefore(savedGrid, editor);

    const filters = document.createElement('div');
    filters.className = 'special-saved-filters-v1964';
    filters.innerHTML =
      '<label class="special-saved-search-v1964"><span>Pesquisar edição</span><input type="search" id="specialSavedSearchV1964" placeholder="Natal, Halloween, Páscoa…" autocomplete="off"></label>' +
      '<label class="special-saved-status-v1964"><span>Estado</span><select id="specialSavedStatusV1964">' +
      '<option value="all">Todas</option><option value="live">A decorrer</option>' +
      '<option value="planned">Agendadas</option><option value="active">Ativas</option>' +
      '<option value="inactive">Inativas</option><option value="ended">Terminadas</option></select></label>' +
      '<span id="specialSavedVisibleCountV1964" class="special-saved-result-v1964" role="status" aria-live="polite"></span>';
    root.insertBefore(filters, savedGrid);

    const below = document.createElement('div');
    below.className = 'special-saved-footer-v1964';
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn special-saved-more-v1964';
    more.textContent = 'Mostrar mais edições';
    below.append(more);
    root.insertBefore(below, editor);

    const resume = document.createElement('button');
    resume.type = 'button';
    resume.className = 'btn special-saved-resume-v1964';
    resume.textContent = 'Retomar edição';
    resume.hidden = true;
    const headerRight = savedHead.querySelector('small')?.parentElement || savedHead;
    headerRight.append(resume);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn special-editor-close-v1964';
    close.textContent = 'Fechar editor';
    close.setAttribute('aria-label', 'Ocultar formulário e voltar às edições guardadas');
    editorHead.append(close);

    const search = document.getElementById('specialSavedSearchV1964');
    const status = document.getElementById('specialSavedStatusV1964');
    const count = document.getElementById('specialSavedVisibleCountV1964');

    function productCards() {
      return Array.from(savedGrid.children).filter(node => node.classList.contains('special-edition-card'));
    }

    function matchesStatus(card, kind) {
      if (kind === 'all') return true;
      const value = card.querySelector('.special-edition-status')?.textContent?.trim().toLocaleUpperCase('pt-PT') || '';
      if (kind === 'live') return value === 'A DECORRER';
      if (kind === 'planned') return value === 'AGENDADA';
      if (kind === 'active') return value === 'ATIVA' || value === 'A DECORRER' || value === 'AGENDADA';
      if (kind === 'inactive') return value === 'INATIVA';
      if (kind === 'ended') return value === 'TERMINADA';
      return true;
    }

    function filterCards() {
      const all = productCards();
      const query = search.value.trim().toLocaleLowerCase('pt-PT');
      const matched = all.filter(card => {
        const name = card.querySelector('h3')?.textContent || '';
        const subtitle = card.querySelector('.special-edition-meta')?.textContent || '';
        return (!query || (name + ' ' + subtitle).toLocaleLowerCase('pt-PT').includes(query)) &&
          matchesStatus(card, status.value);
      });
      const chosen = new Set(matched.slice(0, limit));
      all.forEach(card => {
        card.hidden = !chosen.has(card);
      });
      const shown = Math.min(limit, matched.length);
      count.textContent = all.length
        ? shown + ' de ' + matched.length + ' edição(ões)' + (matched.length !== all.length ? ' filtradas' : '')
        : '';
      more.hidden = matched.length <= shown;
      if (!more.hidden) more.textContent = 'Mostrar mais ' + Math.min(PAGE_SIZE, matched.length - shown) + ' edição(ões)';
      const existingEmpty = document.getElementById('specialSavedEmptyV1964');
      if (existingEmpty) existingEmpty.hidden = matched.length !== 0 || all.length === 0;
    }

    const empty = document.createElement('div');
    empty.id = 'specialSavedEmptyV1964';
    empty.className = 'special-saved-empty-v1964';
    empty.textContent = 'Nenhuma edição corresponde à pesquisa ou ao estado selecionado.';
    empty.hidden = true;
    root.insertBefore(empty, below);

    function resetFilters() {
      search.value = '';
      status.value = 'all';
      limit = PAGE_SIZE;
      filterCards();
    }

    function openEditor(scroll = false) {
      editor.hidden = false;
      resume.hidden = true;
      if (scroll) editor.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    }

    function closeEditor(rememberDraft = false) {
      editor.hidden = true;
      resume.hidden = !rememberDraft;
      savedHead.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    }

    // O click é capturado ANTES dos handlers inline da versão existente:
    // ao editar, o formulário já está visível quando editSpecialEdition faz scroll.
    root.addEventListener('click', event => {
      const btn = event.target.closest('button');
      if (!btn) return;
      const handler = btn.getAttribute('onclick') || '';
      const newEdition = handler.includes('clearSpecialEditionForm(') && !editor.contains(btn);
      const editEdition = savedGrid.contains(btn) && handler.includes('editSpecialEdition(');
      if (newEdition || editEdition) openEditor();
    }, true);

    close.addEventListener('click', () => closeEditor(true));
    resume.addEventListener('click', () => openEditor(true));
    more.addEventListener('click', () => {
      limit += PAGE_SIZE;
      filterCards();
    });
    search.addEventListener('input', () => { limit = PAGE_SIZE; filterCards(); });
    status.addEventListener('change', () => { limit = PAGE_SIZE; filterCards(); });
    new MutationObserver(filterCards).observe(savedGrid, {childList:true});

    // Chamado só depois de a edição ter sido gravada com sucesso na Cloud.
    window.artessenciaSpecialEditionSavedV1964 = () => {
      resetFilters();
      closeEditor(false);
    };

    root.dataset.savedFirstV1964 = '1';
    editor.hidden = true;
    filterCards();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, {once:true});
  else initialise();
})();