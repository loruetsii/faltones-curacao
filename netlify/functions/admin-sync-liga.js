const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const res = await fetch('https://api.football-data.org/v4/competitions/PD/standings', {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
  });

  if (!res.ok) {
    return jsonResponse(502, { error: `Error al consultar football-data.org (${res.status})` });
  }

  const data = await res.json();
  const table = (data.standings || []).find(s => s.type === 'TOTAL')?.table || [];

  const db = getDb();
  let updated = 0;

  for (const row of table) {
    const { error: updateError } = await db
      .from('teams')
      .update({
        liga_position: row.position,
        liga_points: row.points,
        liga_played: row.playedGames
      })
      .eq('api_team_id', row.team.id);
    if (!updateError) updated++;
  }

  return jsonResponse(200, { message: `Clasificación actualizada para ${updated} equipos` });
};
