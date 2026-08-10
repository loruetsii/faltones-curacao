const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

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

  const { matchId, status, kickoffAt } = body;
  if (!matchId) return jsonResponse(400, { error: 'Falta el id del partido' });

  const updates = {};
  if (status) updates.status = status; // 'scheduled' | 'postponed' | 'finished'
  if (kickoffAt) updates.kickoff_at = kickoffAt;

  if (Object.keys(updates).length === 0) {
    return jsonResponse(400, { error: 'Nada que actualizar' });
  }

  const db = getDb();
  const { error: updateError } = await db.from('matches').update(updates).eq('id', matchId);

  if (updateError) return jsonResponse(500, { error: 'No se pudo actualizar el partido' });

  return jsonResponse(200, { message: 'Partido actualizado' });
};
