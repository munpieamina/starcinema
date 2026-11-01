/* STAR CINEMA — схема зала, список мест, фильтры, выбор */
(function (SC) {
  'use strict';

  SC.state = {
    sessionId: null,
    selected: new Set(),
    filters: { cat: 'all', max: 'all' },
    schedule: { date: null, movieId: 'all' },
    movies: { genre: 'all', age: 'all' }
  };

  const LOCK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0110 0v2h1v10H6V10zm2 0h6V8a3 3 0 00-6 0z" fill="currentColor"/></svg>';
  const CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STATUS_TEXT = { free: 'свободно', selected: 'выбрано', occupied: 'занято' };

  const seatsApi = SC.seats = {
    // Единое правило фильтрации для схемы И списка
    matches(seat) {
      const f = SC.state.filters;
      if (f.cat !== 'all' && seat.category !== f.cat) return false;
      if (f.max !== 'all' && seat.price > Number(f.max)) return false;
      return true;
    },
    // Выбранные места остаются видимыми, даже если не проходят фильтр
    isShown(seat) { return seatsApi.matches(seat) || SC.state.selected.has(seat.id); },
    statusOf(seat, occupied) {
      if (occupied.has(seat.id)) return 'occupied';
      return SC.state.selected.has(seat.id) ? 'selected' : 'free';
    },
    label(seat, status) {
      return 'Ряд ' + seat.row + ', место ' + seat.num + ', ' + SC.CATEGORIES[seat.category] + ', ' + SC.fmtPrice(seat.price) + ', ' + STATUS_TEXT[status];
    },

    toggle(id) {
      const seat = SC.SEAT_BY_ID[id], st = SC.state;
      if (!seat || !st.sessionId) return;
      if (SC.booking.occupiedIds(st.sessionId).has(id)) { SC.ui.toast('Это место уже занято', 'error'); return; }
      if (st.selected.has(id)) { st.selected.delete(id); SC.ui.toast('Место ' + id + ' удалено из выбора'); }
      else {
        if (st.selected.size >= SC.CONFIG.maxSeats) { SC.ui.toast('Вы можете выбрать не более ' + SC.CONFIG.maxSeats + ' мест', 'error'); return; }
        st.selected.add(id); SC.ui.toast('Место ' + id + ' добавлено', 'success');
      }
      SC.ui.refreshSeats();
    },

    renderMap(occupied) {
      const box = SC.$('#hallMap'); if (!box) return;
      const prevFocus = box.contains(document.activeElement) ? document.activeElement.dataset.seat : null;
      const zoneStart = { A: 'standard', C: 'comfort', E: 'vip' };
      let html = '';
      SC.ROWS.forEach(row => {
        if (zoneStart[row]) html += '<div class="zone-label zone-' + zoneStart[row] + '">' + SC.CATEGORIES[zoneStart[row]] + ' · ' + SC.fmtPrice(SC.PRICES[zoneStart[row]]) + '</div>';
        html += '<div class="seat-row"><span class="row-label" aria-hidden="true">' + row + '</span>';
        SC.SEATS.filter(s => s.row === row).forEach(seat => {
          const status = seatsApi.statusOf(seat, occupied), shown = seatsApi.isShown(seat);
          const inner = status === 'occupied' ? LOCK : status === 'selected' ? CHECK : seat.num;
          html += '<button type="button" class="seat cat-' + seat.category + ' is-' + status + (shown ? '' : ' is-filtered') + '"' +
            ' data-seat="' + seat.id + '" data-row="' + SC.ROWS.indexOf(seat.row) + '" data-col="' + seat.num + '"' +
            ' aria-label="' + seatsApi.label(seat, status) + '" aria-pressed="' + (status === 'selected') + '"' +
            (status === 'occupied' ? ' aria-disabled="true"' : '') + (shown ? '' : ' tabindex="-1" aria-hidden="true"') +
            ' title="' + seat.id + ' · ' + SC.CATEGORIES[seat.category] + ' · ' + SC.fmtPrice(seat.price) + ' · ' + STATUS_TEXT[status] + '">' + inner + '</button>';
          if (seat.num === 3) html += '<span class="aisle" aria-hidden="true"></span>';
        });
        html += '<span class="row-label" aria-hidden="true">' + row + '</span></div>';
      });
      box.innerHTML = html;
      if (prevFocus) { const el = box.querySelector('[data-seat="' + prevFocus + '"]'); if (el && !el.classList.contains('is-filtered')) el.focus({ preventScroll: true }); }
    },

    renderList(occupied) {
      const box = SC.$('#seatList'); if (!box) return;
      const prevFocus = box.contains(document.activeElement) ? document.activeElement.dataset.seat : null;
      const items = SC.SEATS.filter(seatsApi.isShown);
      SC.$('#seatListCount').textContent = items.length;
      if (!items.length) { box.innerHTML = '<li class="empty-mini">Нет мест, подходящих под фильтры</li>'; return; }
      box.innerHTML = items.map(seat => {
        const status = seatsApi.statusOf(seat, occupied);
        return '<li><button type="button" class="seat-item is-' + status + '" data-seat="' + seat.id + '" aria-pressed="' + (status === 'selected') + '"' +
          (status === 'occupied' ? ' aria-disabled="true"' : '') + ' aria-label="' + seatsApi.label(seat, status) + '">' +
          '<b>' + seat.id + '</b><span>Ряд ' + seat.row + ' · место ' + seat.num + '</span><span class="tag cat-' + seat.category + '">' + SC.CATEGORIES[seat.category] + '</span>' +
          '<span>' + SC.fmtPrice(seat.price) + '</span><em>' + STATUS_TEXT[status] + '</em></button></li>';
      }).join('');
      if (prevFocus) { const el = box.querySelector('[data-seat="' + prevFocus + '"]'); if (el) el.focus({ preventScroll: true }); }
    },

    // Навигация стрелками по схеме
    onKey(e) {
      const dirs = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
      const t = e.target.closest && e.target.closest('.seat');
      if (!t || !dirs[e.key]) return;
      e.preventDefault();
      let r = Number(t.dataset.row), c = Number(t.dataset.col);
      const [dr, dc] = dirs[e.key];
      for (let i = 0; i < 8; i++) {
        r += dr; c += dc;
        if (r < 0 || r >= SC.ROWS.length || c < 1 || c > SC.COLS) return;
        const next = SC.$('.seat[data-row="' + r + '"][data-col="' + c + '"]');
        if (next && !next.classList.contains('is-filtered')) { next.focus(); return; }
      }
    }
  };
})(window.SC);
