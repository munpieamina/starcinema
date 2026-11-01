/* STAR CINEMA — отображение: уведомления, диалоги, карточки, расписание, заказ, билет, «Мои билеты» */
(function (SC) {
  'use strict';
  const $ = SC.$ = (s, r) => (r || document).querySelector(s);
  SC.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = SC.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ui = SC.ui = {};
  const money = SC.fmtPrice;

  /* ---------- Toast и диалоги ---------- */
  ui.toast = (msg, type) => {
    const box = $('#toasts'); if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast toast--' + (type || 'info'); t.textContent = msg;
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 3200);
    while (box.children.length > 4) box.firstChild.remove();
  };
  ui.open = d => { if (d && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } };
  ui.close = d => { if (d && d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } };
  ui.confirm = ({ title, text, ok, cancel }) => new Promise(resolve => {
    const d = $('#confirmDialog'); if (!d) return resolve(false);
    $('#confirmTitle').textContent = title; $('#confirmText').textContent = text;
    $('#confirmOk').textContent = ok || 'Подтвердить'; $('#confirmCancel').textContent = cancel || 'Назад';
    let result = false;
    const onOk = () => { result = true; ui.close(d); };
    const onClose = () => { $('#confirmOk').removeEventListener('click', onOk); d.removeEventListener('close', onClose); resolve(result); };
    $('#confirmOk').addEventListener('click', onOk); d.addEventListener('close', onClose);
    ui.open(d);
  });

  /* ---------- Фильмы ---------- */
  const posterImg = (m, cls) => '<img class="' + (cls || '') + '" src="' + esc(m.poster) + '" alt="Постер фильма «' + esc(m.title) + '»" loading="lazy" width="300" height="450">';

  ui.movieCard = m => '<article class="movie-card reveal">' +
    '<button type="button" class="poster-btn" data-movie-info="' + m.id + '" aria-label="Подробнее о фильме «' + esc(m.title) + '»">' + posterImg(m) + '<span class="age">' + m.age + '</span></button>' +
    '<div class="movie-card__body"><p class="meta"><span>' + esc(m.genre) + '</span><span>' + m.duration + ' мин</span></p>' +
    '<h3>' + esc(m.title) + '</h3><p class="desc">' + esc(m.description) + '</p>' +
    '<div class="card-actions"><button type="button" class="btn btn--primary btn--sm" data-movie-sessions="' + m.id + '">Выбрать сеанс</button>' +
    '<button type="button" class="btn btn--ghost btn--sm" data-movie-info="' + m.id + '">Подробнее</button></div></div></article>';

  ui.renderHome = () => { const g = $('#homeMovies'); if (g) g.innerHTML = SC.MOVIES.map(ui.movieCard).join(''); };

  ui.renderCatalog = () => {
    const g = $('#catalogGrid'); if (!g) return;
    const f = SC.state.movies;
    const list = SC.MOVIES.filter(m => (f.genre === 'all' || m.genre === f.genre) && (f.age === 'all' || m.age === f.age));
    g.innerHTML = list.map(ui.movieCard).join('');
    $('#catalogEmpty').hidden = list.length > 0;
    $('#catalogCount').textContent = 'Найдено фильмов: ' + list.length + ' из ' + SC.MOVIES.length;
  };

  ui.openMovie = id => {
    const m = SC.movieById(id), d = $('#movieDialog'); if (!m || !d) return;
    const dates = SC.getDates().map(x => '<li>' + esc(SC.fmtDate(x.key)) + '</li>').join('');
    $('#movieDialogBody').innerHTML = '<div class="movie-detail">' + posterImg(m, 'movie-detail__poster') + '<div>' +
      '<p class="eyebrow">' + esc(m.genre) + ' · ' + m.duration + ' мин · ' + m.age + '</p><h2 id="movieDialogTitle">' + esc(m.title) + '</h2>' +
      '<p class="muted">Режиссёр: ' + esc(m.director) + '</p><p>' + esc(m.description) + '</p>' +
      '<h3 class="mini-h">Доступные даты</h3><ul class="date-list">' + dates + '</ul>' +
      '<p class="muted">Цены от ' + money(SC.minPrice()) + '</p>' +
      '<button type="button" class="btn btn--primary" data-movie-sessions="' + m.id + '">Выбрать сеанс</button></div></div>';
    ui.open(d);
  };

  /* ---------- Расписание ---------- */
  ui.renderSchedule = () => {
    const tabs = $('#dateTabs'), list = $('#scheduleList'); if (!tabs || !list) return;
    const st = SC.state.schedule, dates = SC.getDates();
    if (!st.date || !dates.some(d => d.key === st.date)) st.date = dates[0].key;
    tabs.innerHTML = dates.map(d => '<button type="button" class="chip' + (d.key === st.date ? ' is-active' : '') + '" data-date="' + d.key + '" aria-pressed="' + (d.key === st.date) + '">' +
      '<span>' + d.date.toLocaleDateString('ru-RU', { weekday: 'short' }) + '</span><b>' + d.date.getDate() + '</b><small>' + d.date.toLocaleDateString('ru-RU', { month: 'short' }) + '</small></button>').join('');
    const sel = $('#scheduleMovie');
    if (sel && !sel.options.length) sel.innerHTML = '<option value="all">Все фильмы</option>' + SC.MOVIES.map(m => '<option value="' + m.id + '">' + esc(m.title) + '</option>').join('');
    if (sel) sel.value = st.movieId;
    $('#scheduleTitle').textContent = 'Сеансы · ' + SC.fmtDate(st.date, { weekday: 'long', day: 'numeric', month: 'long' });
    const sessions = SC.getSessions().filter(s => s.date === st.date && (st.movieId === 'all' || s.movieId === st.movieId));
    const movies = SC.MOVIES.filter(m => sessions.some(s => s.movieId === m.id));
    list.innerHTML = movies.length ? movies.map(m => {
      const btns = sessions.filter(s => s.movieId === m.id).map(s => {
        const hall = SC.hallById(s.hallId), past = SC.isPast(s), free = SC.SEATS.length - SC.booking.occupiedIds(s.id).size;
        const inner = '<b>' + s.time + '</b><span>' + hall.name + '</span><span>от ' + money(SC.minPrice()) + '</span><small>' + (past ? 'Сеанс завершён' : 'Свободно ' + free + ' из ' + SC.SEATS.length) + '</small>';
        return past ? '<button type="button" class="session is-past" disabled>' + inner + '</button>' : '<a class="session" href="#/seats/' + s.id + '">' + inner + '</a>';
      }).join('');
      return '<article class="sched-row reveal">' + posterImg(m, 'sched-row__poster') + '<div><h3>' + esc(m.title) + '</h3><p class="meta"><span>' + esc(m.genre) + '</span><span>' + m.duration + ' мин</span><span>' + m.age + '</span></p><div class="sessions">' + btns + '</div></div></article>';
    }).join('') : '<p class="empty-mini">На выбранную дату сеансов нет.</p>';
    SC.initReveal && SC.initReveal();
  };

  /* ---------- Страница выбора мест ---------- */
  ui.refreshSeats = () => {
    const st = SC.state, session = SC.sessionById(st.sessionId); if (!session) return;
    const occupied = SC.booking.occupiedIds(session.id);
    SC.seats.renderMap(occupied); SC.seats.renderList(occupied);
    $('#freeCount').textContent = SC.SEATS.length - occupied.size;
    ui.renderOrder(session);
  };

  ui.renderSeatsPage = () => {
    const session = SC.sessionById(SC.state.sessionId); if (!session) return;
    const m = SC.movieById(session.movieId), hall = SC.hallById(session.hallId);
    $('#seatsHeader').innerHTML = '<p class="eyebrow">' + esc(SC.fmtDate(session.date, { weekday: 'long', day: 'numeric', month: 'long' })) + ' · ' + session.time + ' · ' + hall.name + '</p>' +
      '<h1>' + esc(m.title) + '</h1><p class="muted">Свободно мест: <b id="freeCount"></b> из ' + SC.SEATS.length + ' · <a href="#/schedule">Сменить сеанс</a></p>';
    $('#filterCat').value = SC.state.filters.cat; $('#filterMax').value = SC.state.filters.max;
    $('#hallTitle').textContent = hall.name;
    ui.refreshSeats();
  };

  ui.renderOrder = session => {
    const box = $('#orderCard'); if (!box) return;
    const st = SC.state, m = SC.movieById(session.movieId), hall = SC.hallById(session.hallId);
    const sum = SC.booking.summarize(Array.from(st.selected));
    const chips = sum.seats.length ? sum.seats.map(s => '<button type="button" class="chip-seat cat-' + s.category + '" data-remove="' + s.id + '" aria-label="Убрать место ' + s.id + ' из выбора">' + s.id + ' · ' + SC.CATEGORIES[s.category] + ' <span aria-hidden="true">✕</span></button>').join('') : '<span class="muted">Места не выбраны</span>';
    const lines = sum.groups.map(g => '<li><span>' + SC.CATEGORIES[g.category] + ': ' + g.count + ' × ' + money(g.price) + '</span><b>' + money(g.sum) + '</b></li>').join('');
    box.innerHTML = '<h2>Ваш заказ</h2><dl class="order-info"><dt>Фильм</dt><dd>' + esc(m.title) + '</dd><dt>Дата</dt><dd>' + esc(SC.fmtDate(session.date)) + '</dd>' +
      '<dt>Сеанс</dt><dd>' + session.time + '</dd><dt>Зал</dt><dd>№' + hall.number + '</dd></dl>' +
      '<h3 class="mini-h">Выбранные места (' + sum.count + '/' + SC.CONFIG.maxSeats + ')</h3><div class="chips" id="selectedSeats">' + chips + '</div>' +
      '<ul class="lines">' + lines + '</ul><p class="muted">Билетов: <b id="ticketCount">' + sum.count + '</b></p>' +
      '<div class="total"><span>Итого</span><strong id="orderTotal">' + money(sum.total) + '</strong></div>' +
      '<p class="form-error" id="orderError" role="alert"></p>' +
      '<button type="button" class="btn btn--primary btn--block" id="btnBook">Забронировать</button>' +
      '<button type="button" class="btn btn--ghost btn--block" id="btnClear"' + (sum.count ? '' : ' disabled') + '>Очистить выбор</button>';
  };

  /* ---------- Оформление брони ---------- */
  ui.openBooking = () => {
    const st = SC.state, session = SC.sessionById(st.sessionId), err = $('#orderError');
    if (!session) return;
    if (!st.selected.size) { ui.toast('Выберите хотя бы одно место', 'error'); if (err) err.textContent = 'Выберите хотя бы одно место'; return; }
    const m = SC.movieById(session.movieId), hall = SC.hallById(session.hallId), sum = SC.booking.summarize(Array.from(st.selected));
    $('#bookSummary').innerHTML = '<dt>Фильм</dt><dd>' + esc(m.title) + '</dd><dt>Дата</dt><dd>' + esc(SC.fmtDate(session.date)) + '</dd><dt>Сеанс</dt><dd>' + session.time + '</dd>' +
      '<dt>Зал</dt><dd>№' + hall.number + '</dd><dt>Места</dt><dd>' + sum.seats.map(s => s.id).join(', ') + '</dd><dt>Итого</dt><dd><b>' + money(sum.total) + '</b></dd>';
    const input = $('#customerName'); input.value = SC.storage.loadSettings().lastName || '';
    ui.setNameError(''); $('#bookError').textContent = '';
    ui.open($('#bookDialog')); input.focus();
  };
  ui.setNameError = msg => { const i = $('#customerName'); $('#nameError').textContent = msg; i.setAttribute('aria-invalid', msg ? 'true' : 'false'); };

  ui.submitBooking = e => {
    e.preventDefault();
    const st = SC.state, name = $('#customerName').value;
    const res = SC.booking.create({ name, sessionId: st.sessionId, seatIds: Array.from(st.selected) });
    if (!res.ok) {
      const er = res.errors;
      ui.setNameError(er.name || '');
      $('#bookError').textContent = er.seats || er.general || '';
      if (er.name) { ui.toast(er.name, 'error'); $('#customerName').focus(); }
      else ui.toast(er.seats || er.general, 'error');
      if (res.conflicts) { res.conflicts.forEach(id => st.selected.delete(id)); ui.close($('#bookDialog')); ui.refreshSeats(); }
      return;
    }
    SC.storage.saveSettings({ lastName: res.booking.customerName });
    st.selected.clear();
    ui.close($('#bookDialog'));
    ui.refreshSeats();
    ui.toast('Бронирование успешно оформлено', 'success');
    ui.showTicket(res.booking.id, true);
  };

  /* ---------- Электронный билет ---------- */
  ui.qrSVG = id => { // декоративный псевдо-QR (не читается сканерами)
    const N = 21; let h = 2166136261;
    for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const inFinder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    let p = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) p += 'M' + x + ' ' + y + 'h1v1h-1z';
    const finder = (fx, fy) => '<rect x="' + (fx + .5) + '" y="' + (fy + .5) + '" width="6" height="6" fill="none" stroke="currentColor"/><rect x="' + (fx + 2) + '" y="' + (fy + 2) + '" width="3" height="3" fill="currentColor"/>';
    return '<svg class="qr" viewBox="-1 -1 ' + (N + 2) + ' ' + (N + 2) + '" role="img" aria-label="Декоративный QR-код (демо)"><path d="' + p + '" fill="currentColor"/>' + finder(0, 0) + finder(N - 7, 0) + finder(0, N - 7) + '</svg>';
  };

  ui.ticketHTML = b => {
    const status = SC.booking.statusOf(b);
    const stamp = status === 'cancelled' ? '<div class="stamp">ОТМЕНЕНО</div>' : status === 'finished' ? '<div class="stamp stamp--done">СЕАНС ЗАВЕРШЁН</div>' : '';
    return '<div class="ticket' + (status === 'cancelled' ? ' is-cancelled' : '') + '"><div class="ticket__main"><p class="ticket__brand">★ STAR CINEMA ★</p>' +
      '<h3>' + esc(b.movieTitle) + '</h3><dl>' +
      '<div><dt>Владелец</dt><dd>' + esc(b.customerName) + '</dd></div><div><dt>Дата</dt><dd>' + esc(SC.fmtDate(b.date)) + '</dd></div>' +
      '<div><dt>Время</dt><dd>' + esc(b.time) + '</dd></div><div><dt>Зал</dt><dd>№' + b.hallNumber + '</dd></div>' +
      '<div><dt>Места</dt><dd>' + esc(b.seatIds.join(', ')) + '</dd></div><div><dt>Билетов</dt><dd>' + b.ticketsCount + '</dd></div>' +
      '<div><dt>Сумма</dt><dd>' + money(b.totalPrice) + '</dd></div></dl></div>' +
      '<div class="ticket__stub">' + ui.qrSVG(b.id) + '<p class="ticket__id">№ ' + esc(b.id) + '</p><p class="ticket__demo">Учебное демо</p></div>' + stamp + '</div>';
  };

  ui.showTicket = (id, isNew) => {
    const b = SC.booking.get(id), d = $('#ticketDialog'); if (!b || !d) return;
    $('#ticketHead').innerHTML = isNew ? '<div class="success"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 27l8 8 16-17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2 id="ticketTitle">Бронирование оформлено!</h2><p class="muted">Ваш электронный билет готов</p>' : '<h2 id="ticketTitle">Электронный билет</h2>';
    $('#ticketBody').innerHTML = ui.ticketHTML(b);
    ui.open(d);
  };

  /* ---------- Мои билеты ---------- */
  const STATUS = { active: ['Активно', 'ok'], cancelled: ['Отменено', 'off'], finished: ['Сеанс завершён', 'done'] };
  ui.renderTickets = () => {
    const box = $('#ticketList'); if (!box) return;
    const all = SC.booking.list().sort((a, b) => b.createdAt.localeCompare(a.createdAt)), s = SC.booking.stats();
    $('#ticketStats').innerHTML = [['Всего броней', s.total], ['Активные', s.active], ['Отменённые', s.cancelled], ['Билетов в активных бронях', s.tickets]]
      .map(x => '<div class="stat"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>').join('');
    if (!all.length) { box.innerHTML = '<div class="empty"><div class="empty__star" aria-hidden="true">★</div><h3>У вас пока нет бронирований</h3><p class="muted">Выберите фильм и займите лучшие места в зале.</p><a class="btn btn--primary" href="#/movies">Выбрать фильм</a></div>'; return; }
    box.innerHTML = all.map(b => {
      const status = SC.booking.statusOf(b), label = STATUS[status];
      return '<article class="booking booking--' + status + '"><img src="' + esc(b.poster || SC.FALLBACK_IMG) + '" alt="Постер «' + esc(b.movieTitle) + '»" width="90" height="135" loading="lazy">' +
        '<div class="booking__info"><p class="booking__id">№ ' + esc(b.id) + ' <span class="badge badge--' + label[1] + '">' + label[0] + '</span></p><h3>' + esc(b.movieTitle) + '</h3>' +
        '<p>' + esc(SC.fmtDate(b.date)) + ', ' + esc(b.time) + ' · Зал №' + b.hallNumber + '</p><p>Места: <b>' + esc(b.seatIds.join(', ')) + '</b> · Билетов: ' + b.ticketsCount + '</p>' +
        '<p class="booking__sum">' + money(b.totalPrice) + '</p></div><div class="booking__actions">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-view-ticket="' + esc(b.id) + '">Посмотреть билет</button>' +
        (status === 'active' ? '<button type="button" class="btn btn--danger btn--sm" data-cancel="' + esc(b.id) + '">Отменить бронирование</button>' : '') + '</div></article>';
    }).join('');
  };

  ui.cancelBooking = async id => {
    const b = SC.booking.get(id); if (!b) return;
    const ok = await ui.confirm({ title: 'Отменить бронирование?', text: 'Бронь ' + b.id + ' («' + b.movieTitle + '», места ' + b.seatIds.join(', ') + ') будет отменена, а места снова станут доступными для других гостей.', ok: 'Да, отменить', cancel: 'Оставить бронь' });
    if (!ok) return;
    if (SC.booking.cancel(id)) { ui.toast('Бронирование отменено', 'success'); ui.renderTickets(); }
    else ui.toast('Эту бронь нельзя отменить', 'error');
  };
})(window.SC);
