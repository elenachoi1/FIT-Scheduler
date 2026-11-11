// Best-time recommendation, kept separate so it can be tested on its own.

export const slotKey = (date, minute) => `${date}_${minute}`;

/**
 * Finds the meeting windows where the most people are free.
 * @param {object} o
 * @param {string[]} o.dates        "YYYY-MM-DD" (New York dates)
 * @param {number}   o.startMin     first minute of the day offered
 * @param {number}   o.endMin       end minute of the day offered
 * @param {number}   o.slotMin      slot size in minutes
 * @param {number}   o.durationMin  meeting length in minutes
 * @param {Map<string, Set<string>>} o.avail  userId → set of slot keys
 * @param {number}   [o.limit=5]
 * @returns {{date:string,start:number,end:number,people:string[]}[]}
 */
export function recommend({ dates, startMin, endMin, slotMin, durationMin, avail, limit = 5 }) {
  const need = Math.max(1, Math.ceil(durationMin / slotMin));
  const users = [...avail.keys()];
  const candidates = [];

  for (const date of [...dates].sort()) {
    for (let s = startMin; s + need * slotMin <= endMin; s += slotMin) {
      const people = users.filter((u) => {
        const set = avail.get(u);
        for (let i = 0; i < need; i++) if (!set.has(slotKey(date, s + i * slotMin))) return false;
        return true;
      });
      if (people.length) {
        // How long the same group stays free after the window: more room to run long is better.
        let slack = 0;
        for (let t = s + need * slotMin; t < endMin; t += slotMin) {
          if (people.every((u) => avail.get(u).has(slotKey(date, t)))) slack++;
          else break;
        }
        candidates.push({ date, start: s, end: s + need * slotMin, people, slack });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      b.people.length - a.people.length ||
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      a.start - b.start
  );

  const picked = [];
  for (const c of candidates) {
    const overlaps = picked.some((p) => p.date === c.date && c.start < p.end && p.start < c.end);
    if (overlaps) continue;
    picked.push(c);
    if (picked.length >= limit) break;
  }
  return picked;
}
