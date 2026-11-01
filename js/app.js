/* STAR CINEMA — запуск, маршрутизация по hash, обработчики событий */
(function (SC) {
  'use strict';
  const { $, $$, ui } = SC;
  const VIEWS = ['home', 'movies', 'schedule', 'seats', 'tickets'];
  const TITLES = { home: 'Главная', movies: 'Фильмы', schedule: 'Расписание', seats: 'Выбор мест', tickets: 'Мои билеты' };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Появление при прокрутке ---------- */
  let observer = null;
  SC.initReveal = () => {
    const items = $$('.reveal:not(.in)');
    if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
    observer = observer || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); } }), { threshold: 0.08 });
    items.forEach(i => observer.observe(i));
  };

  /* ---------- Маршрутизация ---------- */
  const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    let view = VIEWS.includes(parts[0]) ? parts[0] : 'home';
    const st = SC.state;
    if (view === 'seats') {
      const sid = parts[1] || st.sessionId, session = sid && SC.sessionById(sid);
      if (!session) { ui.toast('Сначала выберите сеанс', 'error'); location.replace('#/schedule'); return; }
      if (SC.isPast(session)) { ui.toast('Этот сеанс уже завершён', 'error'); location.replace('#/schedule'); return; }
      if (st.sessionId !== session.id) { st.selected.clear(); st.sessionId = session.id; }
      if (!parts[1]) { location.replace('#/seats/' + session.id); return; }
      ui.renderSeatsPage();
    }
    if (view === 'schedule') ui.renderSchedule();
    if (view === 'tickets') ui.renderTickets();
    if (view === 'movies') ui.renderCatalog();
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    const cur = $('#view-' + view);
    if (cur) { cur.classList.remove('view-enter'); void cur.offsetWidth; cur.classList.add('view-enter'); }
    const navKey = view === 'seats' ? 'schedule' : view;
    $$('[data-nav]').forEach(a => { const on = a.dataset.nav === navKey; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = TITLES[view] + ' — STAR CINEMA';
    $('#siteHeader').classList.remove('nav-open'); $('#navToggle').setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
    SC.initReveal();
  }

  /* ---------- Фильтры ---------- */
  function setupFilters() {
    const genres = [...new Set(SC.MOVIES.map(m => m.genre))], ages = [...new Set(SC.MOVIES.map(m => m.age))].sort((a, b) => parseInt(a) - parseInt(b));
    $('#catGenre').innerHTML = '<option value="all">Все жанры</option>' + genres.map(g => '<option>' + SC.esc(g) + '</option>').join('');
    $('#catAge').innerHTML = '<option value="all">Любой возраст</option>' + ages.map(a => '<option>' + a + '</option>').join('');
    $('#filterCat').innerHTML = '<option value="all">Все категории</option>' + Object.keys(SC.CATEGORIES).map(k => '<option value="' + k + '">' + SC.CATEGORIES[k] + '</option>').join('');
    $('#filterMax').innerHTML = '<option value="all">Любая цена</option>' + [500, 650, 800].map(v => '<option value="' + v + '">До ' + SC.fmtPrice(v) + '</option>').join('');
  }
  const resetCatalog = () => { SC.state.movies = { genre: 'all', age: 'all' }; $('#catGenre').value = 'all'; $('#catAge').value = 'all'; ui.renderCatalog(); SC.initReveal(); };
  const resetSeatFilters = () => { SC.state.filters = { cat: 'all', max: 'all' }; $('#filterCat').value = 'all'; $('#filterMax').value = 'all'; ui.refreshSeats(); ui.toast('Фильтры сброшены'); };

  function openSchedule(movieId) {
    SC.state.schedule.movieId = movieId;
    const free = SC.getDates().find(d => SC.getSessions().some(s => s.date === d.key && s.movieId === movieId && !SC.isPast(s)));
    if (free) SC.state.schedule.date = free.key;
    ui.close($('#movieDialog')); go('#/schedule');
  }

  /* ---------- События ---------- */
  function bind() {
    document.addEventListener('click', e => {
      const t = e.target, hit = sel => t.closest(sel);
      let el;
      if ((el = hit('[data-movie-sessions]'))) return openSchedule(el.dataset.movieSessions);
      if ((el = hit('[data-movie-info]'))) return ui.openMovie(el.dataset.movieInfo);
      if ((el = hit('[data-date]'))) { SC.state.schedule.date = el.dataset.date; return ui.renderSchedule(); }
      if ((el = hit('[data-seat]')) && hit('#view-seats')) return SC.seats.toggle(el.dataset.seat);
      if ((el = hit('[data-remove]'))) return SC.seats.toggle(el.dataset.remove);
      if (hit('#btnBook')) return ui.openBooking();
      if (hit('#btnClear')) { SC.state.selected.clear(); ui.refreshSeats(); return ui.toast('Выбор очищен'); }
      if ((el = hit('[data-view-ticket]'))) return ui.showTicket(el.dataset.viewTicket, false);
      if ((el = hit('[data-cancel]'))) return ui.cancelBooking(el.dataset.cancel);
      if (hit('#goTickets')) { ui.close($('#ticketDialog')); return go('#/tickets'); }
      if (hit('#printTicket')) return window.print();
      if ((el = hit('[data-close]'))) return ui.close(el.closest('dialog'));
      if (hit('#resetSeatFilters')) return resetSeatFilters();
      if (hit('.js-reset-catalog')) return resetCatalog();
      if (hit('#resetDemo')) {
        ui.confirm({ title: 'Сбросить демо-данные?', text: 'Все ваши бронирования, сохранённые в этом браузере, будут удалены.', ok: 'Сбросить', cancel: 'Отмена' }).then(ok => { if (ok) SC.resetDemo(); });
        return;
      }
      if (t.tagName === 'DIALOG') ui.close(t); // клик по подложке
    });
    document.addEventListener('change', e => {
      const id = e.target.id;
      if (id === 'catGenre' || id === 'catAge') { SC.state.movies = { genre: $('#catGenre').value, age: $('#catAge').value }; ui.renderCatalog(); SC.initReveal(); }
      else if (id === 'filterCat' || id === 'filterMax') { SC.state.filters = { cat: $('#filterCat').value, max: $('#filterMax').value }; ui.refreshSeats(); }
      else if (id === 'scheduleMovie') { SC.state.schedule.movieId = e.target.value; ui.renderSchedule(); }
    });
    $('#bookForm').addEventListener('submit', ui.submitBooking);
    $('#customerName').addEventListener('input', () => ui.setNameError(''));
    $('#hallMap').addEventListener('keydown', SC.seats.onKey);
    $('#navToggle').addEventListener('click', () => { const h = $('#siteHeader'), on = h.classList.toggle('nav-open'); $('#navToggle').setAttribute('aria-expanded', String(on)); });
    window.addEventListener('hashchange', route);
    window.addEventListener('storage', e => { if (e.key === SC.CONFIG.bookingsKey) route(); }); // синхронизация между вкладками
    // Резервная картинка, если постер не загрузился
    document.addEventListener('error', e => { const i = e.target; if (i && i.tagName === 'IMG' && !i.dataset.fb) { i.dataset.fb = '1'; i.src = SC.FALLBACK_IMG; } }, true);
  }

  function init() {
    setupFilters(); ui.renderHome(); bind();
    $('#year').textContent = new Date().getFullYear();
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.SC);
