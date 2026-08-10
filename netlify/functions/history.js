const { getDb } = require('./utils/db');
const { jsonResponse, requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAuth(event);
  if (error) return error;

  const db = getDb();

  const { data: matchdays } = await db
    .from('matchdays')
    .select('*')
    .lt('deadline_at', new Date().toISOString())
    .order('number', { ascending: false });

  if (!matchdays || matchdays.length === 0) {
    return jsonResponse(200, { matchdays: [] });
  }

  const matchdayIds = matchdays.map(m => m.id);

  const { data: matches } = await db
    .from('matches')
    .select(`
      id, matchday_id, kickoff_at, status, home_score, away_score,
      home_team:home_team_id ( id, name, crest_url ),
      away_team:away_team_id ( id, name, crest_url )
    `)
    .in('matchday_id', matchdayIds)
    .order('kickoff_at', { ascending: true });

  const matchIds = (matches || []).map(m => m.id);

  const { data: predictions } = await db
    .from('predictions')
    .select(`
      match_id, home_score_pred, away_score_pred, points,
      user:user_id ( id, username, display_name )
    `)
    .in('match_id', matchIds);

  const predsByMatch = {};
  (predictions || []).forEach(p => {
    if (!predsByMatch[p.match_id]) predsByMatch[p.match_id] = [];
    predsByMatch[p.match_id].push({
      user_id: p.user.id,
      username: p.user.display_name || p.user.username,
      home: p.home_score_pred,
      away: p.away_score_pred,
      points: p.points
    });
  });

  const matchesByMatchday = {};
  (matches || []).forEach(m => {
    if (!matchesByMatchday[m.matchday_id]) matchesByMatchday[m.matchday_id] = [];
    matchesByMatchday[m.matchday_id].push({
      ...m,
      predictions: predsByMatch[m.id] || []
    });
  });

  const result = matchdays.map(md => ({
    ...md,
    matches: matchesByMatchday[md.id] || []
  }));

  return jsonResponse(200, { matchdays: result });
};
