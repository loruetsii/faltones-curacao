const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const db = getDb();

  const { data: matchdays } = await db
    .from('matchdays')
    .select('*')
    .order('number', { ascending: true });

  const { data: matches } = await db
    .from('matches')
    .select(`
      id, matchday_id, kickoff_at, status, home_score, away_score,
      home_team:home_team_id ( name ),
      away_team:away_team_id ( name )
    `)
    .order('kickoff_at', { ascending: true });

  const byMatchday = {};
  (matches || []).forEach(m => {
    if (!byMatchday[m.matchday_id]) byMatchday[m.matchday_id] = [];
    byMatchday[m.matchday_id].push(m);
  });

  const result = (matchdays || []).map(md => ({
    ...md,
    matches: byMatchday[md.id] || []
  }));

  return jsonResponse(200, { matchdays: result });
};
