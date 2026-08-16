const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const db = getDb();
  const { data, error: dbError } = await db
    .from('users')
    .select('id, username, display_name, is_admin')
    .eq('is_approved', true)
    .order('username', { ascending: true });

  if (dbError) return jsonResponse(500, { error: 'Error al consultar usuarios' });

  return jsonResponse(200, { users: data });
};
