const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const db = getDb();

  if (event.httpMethod === 'GET') {
    const { data } = await db.from('app_config').select('key, value');
    const config = {};
    (data || []).forEach(row => { config[row.key] = row.value; });
    return jsonResponse(200, { config });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return jsonResponse(400, { error: 'Datos inválidos' });
    }
    const { key, value } = body;
    if (!key) return jsonResponse(400, { error: 'Falta la clave a actualizar' });

    const { error: upsertError } = await db
      .from('app_config')
      .upsert({ key, value }, { onConflict: 'key' });

    if (upsertError) return jsonResponse(500, { error: 'No se pudo guardar' });
    return jsonResponse(200, { message: 'Guardado' });
  }

  return jsonResponse(405, { error: 'Método no permitido' });
};
