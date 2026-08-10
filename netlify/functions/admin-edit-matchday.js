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

  const { matchdayId, deadlineAt } = body;
  if (!matchdayId || !deadlineAt) {
    return jsonResponse(400, { error: 'Faltan datos' });
  }

  const db = getDb();
  const { error: updateError } = await db
    .from('matchdays')
    .update({ deadline_at: deadlineAt })
    .eq('id', matchdayId);

  if (updateError) return jsonResponse(500, { error: 'No se pudo actualizar la jornada' });

  return jsonResponse(200, { message: 'Plazo de la jornada actualizado' });
};
