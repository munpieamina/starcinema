/* STAR CINEMA — данные: цены, залы, места, фильмы, сеансы */
window.SC = window.SC || {};
(function (SC) {
  'use strict';

  SC.CONFIG = { maxSeats: 6, daysAhead: 6, bookingsKey: 'starcinema.bookings.v1', settingsKey: 'starcinema.settings.v1' };

  // Цены — единственное место, где их нужно менять
  SC.PRICES = { standard: 450, comfort: 600, vip: 800 };
  SC.CATEGORIES = { standard: 'Стандарт', comfort: 'Комфорт', vip: 'VIP' };

  SC.ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];
  SC.COLS = 6;
  SC.ROW_CATEGORY = { A: 'standard', B: 'standard', C: 'comfort', D: 'comfort', E: 'vip', F: 'vip' };

  SC.HALLS = [
    { id: 'hall-01', number: 1, name: 'Зал №1' },
    { id: 'hall-02', number: 2, name: 'Зал №2' },
    { id: 'hall-03', number: 3, name: 'Зал №3' }
  ];
  SC.SLOTS = ['12:00', '15:30', '18:00', '20:45'];

  SC.MOVIES = [
    { id: 'movie-01', title: 'Полночь на Бродвее', genre: 'Драма', duration: 128, age: '16+', director: 'Эдвард Марлоу', poster: 'assets/posters/movie-01.svg',
      description: 'Бродвейский композитор в последнюю ночь перед премьерой пытается спасти театр и собственную семью. Камерная история о цене мечты.' },
    { id: 'movie-02', title: 'Тень над Сансетом', genre: 'Триллер', duration: 112, age: '18+', director: 'Ирвин Крейн', poster: 'assets/posters/movie-02.svg',
      description: 'Закат над бульваром, пропавший сценарий и человек, который знает слишком много. Нуар о тех, кто остаётся за кадром.' },
    { id: 'movie-03', title: 'Письма из Лиссабона', genre: 'Романтика', duration: 119, age: '12+', director: 'Мария Дельгадо', poster: 'assets/posters/movie-03.svg',
      description: 'Двадцать лет спустя героиня находит неотправленные письма и отправляется по следам любви, которой не суждено было закончиться.' },
    { id: 'movie-04', title: 'Дело о серебряной орхидее', genre: 'Детектив', duration: 124, age: '12+', director: 'Гарольд Бэнкс', poster: 'assets/posters/movie-04.svg',
      description: 'Частный сыщик получает заказ на поиски редкого цветка — и оказывается в центре клубка из старых семейных тайн.' },
    { id: 'movie-05', title: 'Мистер Бун открывает дверь', genre: 'Комедия', duration: 98, age: '6+', director: 'Оливер Финч', poster: 'assets/posters/movie-05.svg',
      description: 'Скромный клерк находит в офисе незнакомую дверь. За каждой следующей его ждёт всё более нелепое приключение.' },
    { id: 'movie-06', title: 'Хроника тихого экрана', genre: 'Авторское кино', duration: 135, age: '16+', director: 'Анна Ветрова', poster: 'assets/posters/movie-06.svg',
      description: 'Медитативный портрет последнего киномеханика города, где закрывается старый кинотеатр. Почти без слов, но с множеством смыслов.' }
  ];

  SC.FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900"><rect width="600" height="900" fill="#21191A"/><rect x="24" y="24" width="552" height="852" fill="none" stroke="#C5A36A"/><text x="300" y="450" text-anchor="middle" fill="#C5A36A" font-family="serif" font-size="40">★ STAR CINEMA</text></svg>');

  /* ---------- Даты ---------- */
  const pad = n => String(n).padStart(2, '0');
  SC.dateKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  SC.parseKey = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  SC.fmtDate = (key, opts) => SC.parseKey(key).toLocaleDateString('ru-RU', opts || { weekday: 'short', day: 'numeric', month: 'long' });
  SC.fmtPrice = n => Number(n).toLocaleString('ru-RU') + '\u00A0₽';

  SC.getDates = () => {
    const out = [], base = new Date();
    for (let i = 0; i < SC.CONFIG.daysAhead; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      out.push({ key: SC.dateKey(d), date: d });
    }
    return out;
  };

  /* ---------- Места (одинаковая планировка во всех залах) ---------- */
  SC.SEATS = [];
  SC.SEAT_BY_ID = {};
  SC.ROWS.forEach(row => {
    for (let n = 1; n <= SC.COLS; n++) {
      const cat = SC.ROW_CATEGORY[row];
      const seat = { id: row + n, row, num: n, category: cat };
      Object.defineProperty(seat, 'price', { get: () => SC.PRICES[cat], enumerable: true });
      SC.SEATS.push(seat);
      SC.SEAT_BY_ID[seat.id] = seat;
    }
  });

  /* ---------- Сеансы ---------- */
  // 12 комбинаций «время × зал» на день; каждый фильм получает 2 сеанса, набор сдвигается по дням.
  let sessionCache = null, sessionCacheDay = '';
  SC.getSessions = () => {
    const today = SC.dateKey(new Date());
    if (sessionCache && sessionCacheDay === today) return sessionCache;
    const list = [];
    SC.getDates().forEach((day, d) => {
      SC.MOVIES.forEach((movie, i) => {
        [i, i + 6].forEach(base => {
          const idx = (base + d) % 12, slot = idx % 4, hall = SC.HALLS[Math.floor(idx / 4)];
          const [h, m] = SC.SLOTS[slot].split(':').map(Number);
          const start = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), h, m);
          list.push({ id: 'ses-' + day.key.replace(/-/g, '') + '-' + SC.SLOTS[slot].replace(':', '') + '-h' + hall.number,
            movieId: movie.id, hallId: hall.id, date: day.key, time: SC.SLOTS[slot], start });
        });
      });
    });
    list.sort((a, b) => a.start - b.start);
    sessionCache = list; sessionCacheDay = today;
    return list;
  };
  SC.sessionById = id => SC.getSessions().find(s => s.id === id) || null;
  SC.movieById = id => SC.MOVIES.find(m => m.id === id) || null;
  SC.hallById = id => SC.HALLS.find(h => h.id === id) || null;
  SC.isPast = session => session.start.getTime() <= Date.now();
  SC.minPrice = () => Math.min(...Object.values(SC.PRICES));

  /* ---------- Стартовая занятость (детерминированно по ID сеанса) ---------- */
  const seededCache = {};
  SC.seededOccupied = sessionId => {
    if (seededCache[sessionId]) return seededCache[sessionId];
    let h = 2166136261;
    for (const ch of sessionId) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const set = new Set();
    SC.SEATS.forEach(s => { if (rnd() < 0.27) set.add(s.id); });
    return (seededCache[sessionId] = set);
  };
})(window.SC);
