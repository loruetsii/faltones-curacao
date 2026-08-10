const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');
const { calcPoints } = require('./utils/scoring');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido' });
  }

  const { error } = requireAdmin(event);
  if (error) return error;

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return jsonResponse(400, { error: 'Datos inválidos' });
  }

  const { matchId, homeScore, awayScore } = body;
  if (matchId == null || homeScore == null || awayScore == null) {
    return jsonResponse(400, { error: 'Faltan datos' });
  }

  const db = getDb();

  const { error: updateError } = await db.from('matches').update({
    status: 'finished',
    home_score: homeScore,
    away_score: awayScore
  }).eq('id', matchId);

  if (updateError) return jsonResponse(500, { error: 'No se pudo actualizar el partido' });

  const { data: preds } = await db
    .from('predictions')
    .select('id, home_score_pred, away_score_pred')
    .eq('match_id', matchId);

  for (const p of (preds || [])) {
    const points = calcPoints(p.home_score_pred, p.away_score_pred, homeScore, awayScore);
    await db.from('predictions').update({ points }).eq('id', p.id);
  }

  return jsonResponse(200, { message: 'Resultado corregido y puntos recalculados' });
};
