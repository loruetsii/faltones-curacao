const { getDb } = require('./utils/db');
const { jsonResponse, requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAuth(event);
  if (error) return error;

  const db = getDb();

  const { data: users } = await db
    .from('users')
    .select('id, username, display_name, avatar_url')
    .eq('is_approved', true);

  const { data: predictions } = await db
    .from('predictions')
    .select('user_id, points')
    .not('points', 'is', null);

  const stats = {};
  (users || []).forEach(u => {
    stats[u.id] = {
      user_id: u.id,
      username: u.username,
      display_name: u.display_name || u.username,
      avatar_url: u.avatar_url,
      total_points: 0,
      exact_points: 0,
      diff_points: 0,
      winner_points: 0,
      exact_results: 0,
      diff_results: 0,
      winner_only_results: 0,
      winner_accuracy_total: 0, // usado solo para el desempate: incluye exactos y diferencia también
      played: 0
    };
  });

  (predictions || []).forEach(p => {
    const s = stats[p.user_id];
    if (!s) return;
    s.total_points += p.points;
    s.played += 1;
    if (p.points >= 1) s.winner_accuracy_total += 1;
    if (p.points === 6) { s.exact_points += 6; s.exact_results += 1; }
    else if (p.points === 3) { s.diff_points += 2; s.winner_points += 1; s.diff_results += 1; }
    else if (p.points === 1) { s.winner_points += 1; s.winner_only_results += 1; }
  });

  const ranking = Object.values(stats).sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.exact_results !== a.exact_results) return b.exact_results - a.exact_results;
    return b.winner_accuracy_total - a.winner_accuracy_total;
  });

  ranking.forEach((r, i) => { r.position = i + 1; });

  return jsonResponse(200, { ranking });
};
