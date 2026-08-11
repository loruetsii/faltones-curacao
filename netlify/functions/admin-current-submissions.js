const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const db = getDb();

  const { data: matchday } = await db
    .from('matchdays')
    .select('*')
    .gt('deadline_at', new Date().toISOString())
    .order('deadline_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!matchday) {
    return jsonResponse(200, { matchday: null, users: [] });
  }

  const { data: matches } = await db
    .from('matches')
    .select(`
      id, kickoff_at,
      home_team:home_team_id ( name ),
      away_team:away_team_id ( name )
    `)
    .eq('matchday_id', matchday.id)
    .order('kickoff_at', { ascending: true });

  const matchIds = (matches || []).map(m => m.id);

  const { data: approvedUsers } = await db
    .from('users')
    .select('id, username, display_name')
    .eq('is_approved', true);

  const { data: predictions } = await db
    .from('predictions')
    .select('user_id, match_id, home_score_pred, away_score_pred, submitted_at')
    .in('match_id', matchIds);

  const predsByUser = {};
  (predictions || []).forEach(p => {
    if (!predsByUser[p.user_id]) predsByUser[p.user_id] = [];
    predsByUser[p.user_id].push(p);
  });

  const users = (approvedUsers || []).map(u => {
    const preds = predsByUser[u.id] || [];
    return {
      user_id: u.id,
      name: u.display_name || u.username,
      submitted: preds.length > 0,
      submitted_count: preds.length,
      total_matches: matchIds.length,
      predictions: preds.map(p => ({
        match_id: p.match_id,
        home: p.home_score_pred,
        away: p.away_score_pred
      }))
    };
  });

  return jsonResponse(200, { matchday, matches, users });
};
