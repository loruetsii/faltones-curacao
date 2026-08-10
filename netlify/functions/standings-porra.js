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
      exact_results: 0,
      winners_correct: 0,
      played: 0
    };
  });

  (predictions || []).forEach(p => {
    const s = stats[p.user_id];
    if (!s) return;
    s.total_points += p.points;
    s.played += 1;
    if (p.points === 6) s.exact_results += 1;
    if (p.points >= 1) s.winners_correct += 1;
  });

  const ranking = Object.values(stats).sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.exact_results !== a.exact_results) return b.exact_results - a.exact_results;
    return b.winners_correct - a.winners_correct;
  });

  ranking.forEach((r, i) => { r.position = i + 1; });

  return jsonResponse(200, { ranking });
};
