const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const res = await fetch('https://api.football-data.org/v4/competitions/PD/teams', {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
  });

  if (!res.ok) {
    return jsonResponse(502, { error: `Error al consultar football-data.org (${res.status})` });
  }

  const data = await res.json();
  const db = getDb();

  let count = 0;
  for (const team of data.teams || []) {
    const { error: upsertError } = await db.from('teams').upsert({
      api_team_id: team.id,
      name: team.name,
      crest_url: team.crest
    }, { onConflict: 'api_team_id' });
    if (!upsertError) count++;
  }

  return jsonResponse(200, { message: `${count} equipos sincronizados` });
};
