(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const table = document.getElementById('job-table');
  const tbody = document.getElementById('job-rows');
  if (!table || !tbody) return;

  const rows = Array.from(tbody.querySelectorAll('.job-row'));
  const searchInput = document.getElementById('job-search');
  const locationFilter = document.getElementById('location-filter');
  const statusFilter = document.getElementById('status-filter');
  const sortFilter = document.getElementById('sort-filter');
  const categoryControls = Array.from(document.querySelectorAll('[data-category-filter]'));
  const resultCount = document.getElementById('result-count');
  const visibleCount = document.getElementById('visible-count');
  const emptyState = document.getElementById('empty-state');
  const clearButton = document.getElementById('clear-filters');
  const emptyReset = document.getElementById('empty-reset');

  const defaults = {
    category: 'all',
    location: 'all',
    status: 'open',
    sort: 'deadline',
    query: '',
  };

  const valid = {
    category: new Set(['all', 'contract', 'assistant', 'administrator']),
    status: new Set(['open', 'soon', 'all', 'closed']),
    sort: new Set(['deadline', 'newest', 'title', 'salary']),
  };

  const state = { ...defaults };
  const params = new URLSearchParams(window.location.search);
  if (valid.category.has(params.get('category'))) state.category = params.get('category');
  if (valid.status.has(params.get('status'))) state.status = params.get('status');
  if (valid.sort.has(params.get('sort'))) state.sort = params.get('sort');
  if (params.get('location')) state.location = params.get('location');
  if (params.get('q')) state.query = params.get('q');

  function normalise(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function statusMatches(status) {
    if (state.status === 'all') return true;
    if (state.status === 'closed') return status === 'closed';
    if (state.status === 'soon') return status === 'soon' || status === 'today';
    return status !== 'closed';
  }

  function rowMatches(row) {
    if (state.category !== 'all' && row.dataset.category !== state.category) return false;
    if (state.location !== 'all' && row.dataset.country !== state.location) return false;
    if (!statusMatches(row.dataset.status)) return false;
    if (state.query) {
      const haystack = normalise(row.dataset.search);
      const tokens = normalise(state.query).split(' ').filter(Boolean);
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    return true;
  }

  function sortedRows() {
    return [...rows].sort((a, b) => {
      if (state.sort === 'newest') {
        return (b.dataset.published || '').localeCompare(a.dataset.published || '');
      }
      if (state.sort === 'title') {
        return (a.dataset.title || '').localeCompare(b.dataset.title || '', 'en', { sensitivity: 'base' });
      }
      if (state.sort === 'salary') {
        return Number(b.dataset.salary || 0) - Number(a.dataset.salary || 0);
      }
      const aClosed = a.dataset.status === 'closed' ? 1 : 0;
      const bClosed = b.dataset.status === 'closed' ? 1 : 0;
      if (aClosed !== bClosed) return aClosed - bClosed;
      return (a.dataset.deadline || '').localeCompare(b.dataset.deadline || '');
    });
  }

  function updateUrl() {
    const next = new URLSearchParams();
    if (state.category !== defaults.category) next.set('category', state.category);
    if (state.location !== defaults.location) next.set('location', state.location);
    if (state.status !== defaults.status) next.set('status', state.status);
    if (state.sort !== defaults.sort) next.set('sort', state.sort);
    if (state.query.trim()) next.set('q', state.query.trim());
    const query = next.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  }

  function applyFilters() {
    if (locationFilter) locationFilter.value = state.location;
    if (statusFilter) statusFilter.value = state.status;
    if (sortFilter) sortFilter.value = state.sort;
    if (searchInput && searchInput.value !== state.query) searchInput.value = state.query;

    categoryControls.forEach((control) => {
      const active = control.dataset.categoryFilter === state.category;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', String(active));
    });

    const ordered = sortedRows();
    ordered.forEach((row) => tbody.appendChild(row));

    let shown = 0;
    rows.forEach((row) => {
      const match = rowMatches(row);
      row.hidden = !match;
      if (match) shown += 1;
    });

    const total = rows.length;
    const label = `Showing ${shown} of ${total}`;
    if (resultCount) resultCount.textContent = label;
    if (visibleCount) {
      visibleCount.textContent = shown === 1 ? '1 role shown' : `${shown} roles shown`;
    }
    if (emptyState) emptyState.hidden = shown !== 0;
    table.hidden = shown === 0;

    updateUrl();
  }

  let searchTimer;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = searchInput.value;
      applyFilters();
    }, 90);
  });

  locationFilter?.addEventListener('change', () => {
    state.location = locationFilter.value;
    applyFilters();
  });

  statusFilter?.addEventListener('change', () => {
    state.status = statusFilter.value;
    applyFilters();
  });

  sortFilter?.addEventListener('change', () => {
    state.sort = sortFilter.value;
    applyFilters();
  });

  categoryControls.forEach((control) => {
    control.addEventListener('click', () => {
      state.category = control.dataset.categoryFilter;
      applyFilters();
      if (control.classList.contains('category-door')) {
        document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  document.querySelectorAll('[data-focus-search]').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => searchInput?.focus({ preventScroll: true }), 450);
    });
  });

  function resetFilters() {
    Object.assign(state, defaults);
    applyFilters();
    searchInput?.focus({ preventScroll: true });
  }

  clearButton?.addEventListener('click', resetFilters);
  emptyReset?.addEventListener('click', () => {
    resetFilters();
    document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target instanceof HTMLElement
      && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

    if (event.key === '/' && !typing) {
      event.preventDefault();
      searchInput?.focus();
    }

    if (event.key === 'Escape' && target === searchInput) {
      searchInput.value = '';
      state.query = '';
      applyFilters();
      searchInput.blur();
    }
  });

  applyFilters();
})();
