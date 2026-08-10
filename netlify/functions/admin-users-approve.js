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

  const { userId } = body;
  if (!userId) return jsonResponse(400, { error: 'Falta el id del usuario' });

  const db = getDb();
  const { error: dbError } = await db
    .from('users')
    .update({ is_approved: true })
    .eq('id', userId);

  if (dbError) return jsonResponse(500, { error: 'No se pudo aprobar al usuario' });

  return jsonResponse(200, { message: 'Usuario aprobado' });
};
