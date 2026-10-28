(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const table = document.getElementById('job-table');
  const tbody = document.getElementById('job-rows');
  if (!table || !tbody) return;

  const PAGE_SIZE = 10;
  const rows = Array.from(tbody.querySelectorAll('.job-row'));
  const searchInput = document.getElementById('job-search');
  const locationFilter = document.getElementById('location-filter');
  const statusFilter = document.getElementById('status-filter');
  const sortFilter = document.getElementById('sort-filter');
  const categoryControls = Array.from(document.querySelectorAll('[data-category-filter]'));
  const mapDots = Array.from(document.querySelectorAll('[data-map-country]'));
  const mapCanvas = document.querySelector('.map-card__canvas');
  const resultCount = document.getElementById('result-count');
  const visibleCount = document.getElementById('visible-count');
  const emptyState = document.getElementById('empty-state');
  const clearButton = document.getElementById('clear-filters');
  const emptyReset = document.getElementById('empty-reset');
  const pagination = document.getElementById('pagination');
  const pageTabs = document.getElementById('page-tabs');
  const pageSummary = document.getElementById('page-summary');
  const previousButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');

  const defaults = {
    category: 'all',
    location: 'all',
    status: 'all',
    sort: 'deadline',
    query: '',
    page: 1,
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
  const requestedPage = Number.parseInt(params.get('page'), 10);
  if (Number.isInteger(requestedPage) && requestedPage > 0) state.page = requestedPage;

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
    if (state.page > 1) next.set('page', String(state.page));
    const query = next.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  }

  function renderPagination(totalPages, totalMatches) {
    if (!pagination || !pageTabs) return;

    const show = totalMatches > PAGE_SIZE;
    pagination.hidden = !show;
    if (!show) {
      pageTabs.replaceChildren();
      return;
    }

    pageTabs.replaceChildren();
    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'page-tab';
      button.textContent = String(page).padStart(2, '0');
      button.setAttribute('aria-label', `Page ${page} of ${totalPages}`);
      if (page === state.page) {
        button.classList.add('is-active');
        button.setAttribute('aria-current', 'page');
      }
      button.addEventListener('click', () => {
        if (state.page === page) return;
        state.page = page;
        applyFilters();
        scrollToTable();
      });
      pageTabs.appendChild(button);
    }

    if (pageSummary) pageSummary.textContent = `Page ${state.page} of ${totalPages}`;
    if (previousButton) previousButton.disabled = state.page <= 1;
    if (nextButton) nextButton.disabled = state.page >= totalPages;
  }

  function scrollToTable() {
    document.querySelector('.table-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function layoutMapDots() {
    if (!mapCanvas || !mapDots.length) return;
    const width = mapCanvas.clientWidth;
    const height = mapCanvas.clientHeight;
    if (!width || !height) return;

    const padding = 14;
    const minDistance = 28;
    const points = mapDots.map((element) => ({
      element,
      x: Math.max(padding, Math.min(width - padding, (Number(element.dataset.mapX) / 100) * width)),
      y: Math.max(padding, Math.min(height - padding, (Number(element.dataset.mapY) / 100) * height)),
    }));

    for (let iteration = 0; iteration < 80; iteration += 1) {
      let moved = false;
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const a = points[i];
          const b = points[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy);
          if (distance >= minDistance) continue;
          if (distance < 0.01) {
            dx = 1;
            dy = 0;
            distance = 1;
          }
          const push = (minDistance - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          moved = true;
        }
      }
      for (const point of points) {
        point.x = Math.max(padding, Math.min(width - padding, point.x));
        point.y = Math.max(padding, Math.min(height - padding, point.y));
      }
      if (!moved) break;
    }

    for (const point of points) {
      point.element.style.left = `${point.x}px`;
      point.element.style.top = `${point.y}px`;
    }
  }

  function applyFilters({ resetPage = false } = {}) {
    if (resetPage) state.page = 1;

    if (locationFilter) locationFilter.value = state.location;
    if (statusFilter) statusFilter.value = state.status;
    if (sortFilter) sortFilter.value = state.sort;
    if (searchInput && searchInput.value !== state.query) searchInput.value = state.query;

    categoryControls.forEach((control) => {
      const active = control.dataset.categoryFilter === state.category;
      control.classList.toggle('is-active', active);
      control.setAttribute('aria-pressed', String(active));
    });

    mapDots.forEach((dot) => {
      dot.classList.toggle('is-active', dot.dataset.mapCountry === state.location);
    });

    const ordered = sortedRows();
    ordered.forEach((row) => tbody.appendChild(row));

    const matched = ordered.filter(rowMatches);
    const totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);

    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = matched.slice(start, start + PAGE_SIZE);
    const visible = new Set(pageRows);

    rows.forEach((row) => {
      row.hidden = !visible.has(row);
    });

    const shown = pageRows.length;
    const rangeStart = shown ? start + 1 : 0;
    const rangeEnd = shown ? start + shown : 0;
    const range = rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}–${rangeEnd}`;
    const label = shown
      ? `Showing ${range} of ${matched.length}`
      : 'No matching roles';

    if (resultCount) resultCount.textContent = label;
    if (visibleCount) {
      visibleCount.textContent = matched.length
        ? `Page ${state.page} of ${totalPages} · ${matched.length} roles`
        : '0 roles';
    }
    if (emptyState) emptyState.hidden = matched.length !== 0;
    table.hidden = matched.length === 0;
    renderPagination(totalPages, matched.length);
    updateUrl();
  }

  let searchTimer;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = searchInput.value;
      applyFilters({ resetPage: true });
    }, 90);
  });

  locationFilter?.addEventListener('change', () => {
    state.location = locationFilter.value;
    applyFilters({ resetPage: true });
  });

  statusFilter?.addEventListener('change', () => {
    state.status = statusFilter.value;
    applyFilters({ resetPage: true });
  });

  sortFilter?.addEventListener('change', () => {
    state.sort = sortFilter.value;
    applyFilters({ resetPage: true });
  });

  categoryControls.forEach((control) => {
    control.addEventListener('click', () => {
      state.category = control.dataset.categoryFilter;
      applyFilters({ resetPage: true });
      if (control.classList.contains('category-door')) {
        document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  mapDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      state.location = dot.dataset.mapCountry;
      applyFilters({ resetPage: true });
      document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-focus-search]').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => searchInput?.focus({ preventScroll: true }), 450);
    });
  });

  previousButton?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    applyFilters();
    scrollToTable();
  });

  nextButton?.addEventListener('click', () => {
    if (nextButton.disabled) return;
    state.page += 1;
    applyFilters();
    scrollToTable();
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
      applyFilters({ resetPage: true });
      searchInput.blur();
    }
  });

  applyFilters();
  layoutMapDots();

  let mapResizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(mapResizeTimer);
    mapResizeTimer = window.setTimeout(layoutMapDots, 120);
  });
})();
