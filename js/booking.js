/* STAR CINEMA — логика бронирования (без работы с DOM) */
(function (SC) {
  'use strict';

  const byRowNum = (a, b) => a.row.localeCompare(b.row) || a.num - b.num;

  SC.booking = {
    list() { return SC.storage.loadBookings(); },
    get(id) { return this.list().find(b => b.id === id) || null; },

    // active | cancelled | finished
    statusOf(b) {
      if (b.status === 'cancelled') return 'cancelled';
      const end = new Date(b.startsAt).getTime() + (b.durationMin || 0) * 60000;
      return Date.now() > end ? 'finished' : 'active';
    },

    // Занятые места сеанса = стартовая занятость + места из активных броней
    occupiedIds(sessionId) {
      const set = new Set(SC.seededOccupied(sessionId));
      this.list().forEach(b => { if (b.sessionId === sessionId && b.status === 'active') b.seatIds.forEach(id => set.add(id)); });
      return set;
    },

    // Расчёт заказа по реально выбранным местам
    summarize(seatIds) {
      const seats = [...new Set(seatIds)].map(id => SC.SEAT_BY_ID[id]).filter(Boolean).sort(byRowNum);
      const groups = {};
      seats.forEach(s => {
        const g = groups[s.category] || (groups[s.category] = { category: s.category, count: 0, price: s.price, sum: 0 });
        g.count++; g.sum += s.price;
      });
      const ordered = ['standard', 'comfort', 'vip'].filter(c => groups[c]).map(c => groups[c]);
      return { seats, groups: ordered, count: seats.length, total: seats.reduce((t, s) => t + s.price, 0) };
    },

    validateName(name) {
      const n = (name || '').trim().replace(/\s+/g, ' ');
      if (!n) return 'Заполните имя';
      if (n.length < 2) return 'Имя слишком короткое (минимум 2 символа)';
      if (n.length > 40) return 'Имя слишком длинное (максимум 40 символов)';
      if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(n)) return 'Имя может содержать только буквы, пробелы, точку и дефис';
      return '';
    },

    newId() {
      const used = new Set(this.list().map(b => b.id));
      let id; do { id = 'SC-' + String(Math.floor(100000 + Math.random() * 900000)); } while (used.has(id));
      return id;
    },

    // Возвращает { ok, booking } либо { ok:false, errors:{name,seats,general}, conflicts:[] }
    create({ name, sessionId, seatIds }) {
      const errors = {};
      const session = SC.sessionById(sessionId);
      if (!session) return { ok: false, errors: { general: 'Сеанс не найден' } };
      if (SC.isPast(session)) return { ok: false, errors: { general: 'Сеанс уже начался или завершён' } };
      const nameErr = this.validateName(name);
      if (nameErr) errors.name = nameErr;
      const ids = [...new Set(seatIds || [])];
      if (!ids.length) errors.seats = 'Выберите хотя бы одно место';
      else if (ids.length > SC.CONFIG.maxSeats) errors.seats = 'Вы можете выбрать не более ' + SC.CONFIG.maxSeats + ' мест';
      else if (ids.some(id => !SC.SEAT_BY_ID[id])) errors.seats = 'Выбраны несуществующие места';
      if (errors.name || errors.seats) return { ok: false, errors };

      // Повторная проверка актуальной занятости (данные могли измениться в другой вкладке)
      const occupied = this.occupiedIds(sessionId);
      const conflicts = ids.filter(id => occupied.has(id));
      if (conflicts.length) return { ok: false, errors: { general: 'Места уже заняты: ' + conflicts.join(', ') }, conflicts };

      const movie = SC.movieById(session.movieId), hall = SC.hallById(session.hallId), sum = this.summarize(ids);
      const booking = {
        id: this.newId(), customerName: name.trim().replace(/\s+/g, ' '),
        movieId: movie.id, movieTitle: movie.title, poster: movie.poster, durationMin: movie.duration,
        sessionId, hallId: hall.id, hallName: hall.name, hallNumber: hall.number,
        date: session.date, time: session.time, startsAt: session.start.toISOString(),
        seatIds: sum.seats.map(s => s.id), seats: sum.seats.map(s => ({ id: s.id, category: s.category, price: s.price })),
        ticketsCount: sum.count, totalPrice: sum.total, status: 'active',
        createdAt: new Date().toISOString(), cancelledAt: null
      };
      const all = this.list(); all.push(booking);
      if (!SC.storage.saveBookings(all)) return { ok: false, errors: { general: 'Не удалось сохранить бронь' } };
      return { ok: true, booking };
    },

    cancel(id) {
      const all = this.list(), b = all.find(x => x.id === id);
      if (!b || this.statusOf(b) !== 'active') return false;
      b.status = 'cancelled'; b.cancelledAt = new Date().toISOString();
      SC.storage.saveBookings(all);
      return true;
    },

    stats() {
      const all = this.list();
      return {
        total: all.length,
        active: all.filter(b => this.statusOf(b) === 'active').length,
        cancelled: all.filter(b => b.status === 'cancelled').length,
        tickets: all.filter(b => b.status === 'active').reduce((t, b) => t + b.ticketsCount, 0)
      };
    }
  };
})(window.SC);
