const { getDb } = require('./utils/db');
const { jsonResponse, requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAuth(event);
  if (error) return error;

  const db = getDb();
  const { data: teams } = await db
    .from('teams')
    .select('id, name, crest_url, liga_position, liga_points, liga_played')
    .order('liga_position', { ascending: true });

  return jsonResponse(200, { teams: teams || [] });
};
