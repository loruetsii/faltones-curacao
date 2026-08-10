const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');
const { calcDeadline } = require('./utils/madridTime');

const MIDWEEK_MATCHDAYS = [6, 33];

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const db = getDb();

  const { data: teams } = await db.from('teams').select('id, api_team_id');
  if (!teams || teams.length === 0) {
    return jsonResponse(400, { error: 'Primero sincroniza los equipos (admin-sync-teams)' });
  }
  const teamByApiId = {};
  teams.forEach(t => { teamByApiId[t.api_team_id] = t.id; });

  const res = await fetch('https://api.football-data.org/v4/competitions/PD/matches?season=2026', {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
  });

  if (!res.ok) {
    return jsonResponse(502, { error: `Error al consultar football-data.org (${res.status})` });
  }

  const data = await res.json();
  const matches = data.matches || [];

  const byMatchday = {};
  matches.forEach(m => {
    const n = m.matchday;
    if (!byMatchday[n]) byMatchday[n] = [];
    byMatchday[n].push(m);
  });

  // 1) Construimos TODAS las jornadas de golpe y las guardamos en una sola llamada
  const matchdayRows = Object.keys(byMatchday).map(numberStr => {
    const number = parseInt(numberStr, 10);
    const matchesOfDay = byMatchday[number];
    const isMidweek = MIDWEEK_MATCHDAYS.includes(number);
    const firstKickoff = matchesOfDay
      .map(m => new Date(m.utcDate).getTime())
      .sort((a, b) => a - b)[0];
    const deadline = calcDeadline(new Date(firstKickoff), isMidweek);
    return { number, deadline_at: deadline.toISOString(), is_midweek: isMidweek };
  });

  const { data: savedMatchdays, error: mdError } = await db
    .from('matchdays')
    .upsert(matchdayRows, { onConflict: 'number' })
    .select();

  if (mdError) {
    return jsonResponse(500, { error: 'Error guardando jornadas: ' + mdError.message });
  }

  const matchdayIdByNumber = {};
  savedMatchdays.forEach(md => { matchdayIdByNumber[md.number] = md.id; });

  // 2) Construimos TODOS los partidos de golpe y los guardamos en una sola llamada
  const matchRows = [];
  for (const numberStr of Object.keys(byMatchday)) {
    const number = parseInt(numberStr, 10);
    const matchdayId = matchdayIdByNumber[number];
    if (!matchdayId) continue;

    for (const m of byMatchday[number]) {
      const homeId = teamByApiId[m.homeTeam.id];
      const awayId = teamByApiId[m.awayTeam.id];
      if (!homeId || !awayId) continue;

      const status = m.status === 'FINISHED' ? 'finished'
        : m.status === 'POSTPONED' ? 'postponed'
        : 'scheduled';

      matchRows.push({
        api_match_id: m.id,
        matchday_id: matchdayId,
        home_team_id: homeId,
        away_team_id: awayId,
        kickoff_at: m.utcDate,
        status,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null
      });
    }
  }

  // Supabase permite mandar hasta varios cientos de filas en una sola llamada sin problema,
  // pero lo troceamos en bloques de 100 por seguridad.
  let matchesCreated = 0;
  const chunkSize = 100;
  for (let i = 0; i < matchRows.length; i += chunkSize) {
    const chunk = matchRows.slice(i, i + chunkSize);
    const { error: matchError } = await db
      .from('matches')
      .upsert(chunk, { onConflict: 'api_match_id' });
    if (!matchError) matchesCreated += chunk.length;
  }

  return jsonResponse(200, {
    message: `${savedMatchdays.length} jornadas y ${matchesCreated} partidos sincronizados`
  });
};
