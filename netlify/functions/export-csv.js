const { getDb } = require('./utils/db');
const { requireAuth, getUserFromEvent } = require('./utils/auth');

function toCsvRow(fields) {
  return fields.map(f => {
    const s = String(f ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';');
}

exports.handler = async (event) => {
  const user = getUserFromEvent(event);
  if (!user) return { statusCode: 401, body: 'No autenticado' };

  const db = getDb();

  const { data: users } = await db
    .from('users')
    .select('id, username, display_name')
    .eq('is_approved', true);

  const { data: predictions } = await db
    .from('predictions')
    .select('user_id, points')
    .not('points', 'is', null);

  const stats = {};
  (users || []).forEach(u => {
    stats[u.id] = { name: u.display_name || u.username, total: 0, exact: 0, winners: 0 };
  });
  (predictions || []).forEach(p => {
    const s = stats[p.user_id];
    if (!s) return;
    s.total += p.points;
    if (p.points === 6) s.exact += 1;
    if (p.points >= 1) s.winners += 1;
  });

  const rows = Object.values(stats).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.exact !== a.exact) return b.exact - a.exact;
    return b.winners - a.winners;
  });

  const lines = [toCsvRow(['Posición', 'Nombre', 'Puntos', 'Resultados exactos', 'Ganadores acertados'])];
  rows.forEach((r, i) => {
    lines.push(toCsvRow([i + 1, r.name, r.total, r.exact, r.winners]));
  });

  const csv = '\uFEFF' + lines.join('\n');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clasificacion-faltones-curacao.csv"'
    },
    body: csv
  };
};
