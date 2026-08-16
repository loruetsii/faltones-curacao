const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');
const { calcPoints } = require('./utils/scoring');

// Recalcula los puntos de TODOS los pronósticos de partidos ya finalizados,
// usando la fórmula de puntuación actual (utils/scoring.js). Útil después
// de cambiar las reglas de puntuación, para que los partidos ya jugados
// se actualicen también (no solo los que se puntúen a partir de ahora).
exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const db = getDb();

  const { data: finishedMatches } = await db
    .from('matches')
    .select('id, home_score, away_score')
    .eq('status', 'finished')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);

  if (!finishedMatches || finishedMatches.length === 0) {
    return jsonResponse(200, { message: 'No hay partidos finalizados todavía' });
  }

  let recalculated = 0;

  for (const m of finishedMatches) {
    const { data: preds } = await db
      .from('predictions')
      .select('id, home_score_pred, away_score_pred')
      .eq('match_id', m.id);

    for (const p of (preds || [])) {
      const points = calcPoints(p.home_score_pred, p.away_score_pred, m.home_score, m.away_score);
      await db.from('predictions').update({ points }).eq('id', p.id);
      recalculated++;
    }
  }

  return jsonResponse(200, {
    message: `${recalculated} pronósticos recalculados en ${finishedMatches.length} partidos`
  });
};
