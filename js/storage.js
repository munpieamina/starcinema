/* STAR CINEMA — работа с localStorage (с защитой от повреждённых данных и отключённого хранилища) */
(function (SC) {
  'use strict';
  const memory = {}; // запасной вариант, если localStorage недоступен
  const safe = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return memory[k] || null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { memory[k] = v; return false; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } delete memory[k]; }
  };
  const STATUSES = ['active', 'cancelled'];
  const valid = b => b && typeof b === 'object' && typeof b.id === 'string' && typeof b.sessionId === 'string' &&
    Array.isArray(b.seatIds) && b.seatIds.every(x => typeof x === 'string') && typeof b.totalPrice === 'number' && STATUSES.includes(b.status);

  SC.storage = {
    loadBookings() {
      try {
        const raw = safe.get(SC.CONFIG.bookingsKey);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter(valid) : [];
      } catch (e) { return []; }
    },
    saveBookings(list) { return safe.set(SC.CONFIG.bookingsKey, JSON.stringify(list)) || true; },
    loadSettings() {
      try { const s = JSON.parse(safe.get(SC.CONFIG.settingsKey) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; }
    },
    saveSettings(patch) { safe.set(SC.CONFIG.settingsKey, JSON.stringify(Object.assign(SC.storage.loadSettings(), patch))); },
    resetAll() { safe.del(SC.CONFIG.bookingsKey); safe.del(SC.CONFIG.settingsKey); }
  };
  SC.resetDemo = () => { SC.storage.resetAll(); location.hash = '#/home'; location.reload(); };
})(window.SC);
