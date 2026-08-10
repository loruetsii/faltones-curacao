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

  let matchdaysCreated = 0;
  let matchesCreated = 0;

  for (const numberStr of Object.keys(byMatchday)) {
    const number = parseInt(numberStr, 10);
    const matchesOfDay = byMatchday[number];
    const isMidweek = MIDWEEK_MATCHDAYS.includes(number);

    const firstKickoff = matchesOfDay
      .map(m => new Date(m.utcDate).getTime())
      .sort((a, b) => a - b)[0];

    const deadline = calcDeadline(new Date(firstKickoff), isMidweek);

    const { data: mdRow, error: mdError } = await db
      .from('matchdays')
      .upsert({
        number,
        deadline_at: deadline.toISOString(),
        is_midweek: isMidweek
      }, { onConflict: 'number' })
      .select()
      .single();

    if (mdError || !mdRow) continue;
    matchdaysCreated++;

    for (const m of matchesOfDay) {
      const homeId = teamByApiId[m.homeTeam.id];
      const awayId = teamByApiId[m.awayTeam.id];
      if (!homeId || !awayId) continue;

      const status = m.status === 'FINISHED' ? 'finished'
        : m.status === 'POSTPONED' ? 'postponed'
        : 'scheduled';

      const { error: matchError } = await db.from('matches').upsert({
        api_match_id: m.id,
        matchday_id: mdRow.id,
        home_team_id: homeId,
        away_team_id: awayId,
        kickoff_at: m.utcDate,
        status,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null
      }, { onConflict: 'api_match_id' });

      if (!matchError) matchesCreated++;
    }
  }

  return jsonResponse(200, {
    message: `${matchdaysCreated} jornadas y ${matchesCreated} partidos sincronizados`
  });
};
