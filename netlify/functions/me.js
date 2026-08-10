const { getDb } = require('./utils/db');
const { jsonResponse, requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  const { user, error } = requireAuth(event);
  if (error) return error;

  const db = getDb();
  const { data } = await db
    .from('users')
    .select('id, username, display_name, avatar_url, is_admin')
    .eq('id', user.sub)
    .maybeSingle();

  if (!data) return jsonResponse(401, { error: 'Usuario no encontrado' });

  return jsonResponse(200, {
    user: {
      ...data,
      needs_profile_setup: !data.display_name
    }
  });
};
