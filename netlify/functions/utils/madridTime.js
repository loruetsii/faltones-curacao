// Convierte una hora "de pared" en Madrid (peninsular) a un instante UTC real,
// teniendo en cuenta el cambio de horario de verano/invierno automáticamente.
function madridWallTimeToUtc(year, month, day, hour, minute) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = fmt.formatToParts(guess).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = parseInt(p.value, 10);
    return acc;
  }, {});
  // formatToParts con hour12:false puede devolver "24" en vez de "00"
  const hh = parts.hour === 24 ? 0 : parts.hour;
  const guessedMadrid = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hh, parts.minute));
  const diff = guess.getTime() - guessedMadrid.getTime();
  return new Date(guess.getTime() + diff);
}

// Dado un instante UTC, devuelve {year, month, day} de la fecha correspondiente en Madrid.
function utcToMadridDateParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = parseInt(p.value, 10);
    return acc;
  }, {});
  return { year: parts.year, month: parts.month, day: parts.day };
}

// Calcula el día objetivo (viernes o martes) anterior o igual a una fecha dada,
// trabajando solo con fechas de calendario (sin horas).
// targetDow: 5 = viernes, 2 = martes (convención JS: domingo=0)
function precedingWeekday(year, month, day, targetDow) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const currentDow = date.getUTCDay();
  const diff = (currentDow - targetDow + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

// Calcula el plazo (deadline) de una jornada a partir de la fecha de su primer partido.
function calcDeadline(firstMatchUtcDate, isMidweek) {
  const madridDate = utcToMadridDateParts(new Date(firstMatchUtcDate));
  const targetDow = isMidweek ? 2 : 5; // martes o viernes
  const targetHour = isMidweek ? 17 : 18;
  const dayParts = precedingWeekday(madridDate.year, madridDate.month, madridDate.day, targetDow);
  return madridWallTimeToUtc(dayParts.year, dayParts.month, dayParts.day, targetHour, 0);
}

module.exports = { madridWallTimeToUtc, utcToMadridDateParts, precedingWeekday, calcDeadline };
