const bcrypt = require('bcryptjs');
const { getDb } = require('./utils/db');
const { jsonResponse, signToken } = require('./utils/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido' });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return jsonResponse(400, { error: 'Datos inválidos' });
  }

  const { username, password } = body;
  if (!username || !password) {
    return jsonResponse(400, { error: 'Faltan campos por rellenar' });
  }

  const db = getDb();
  const { data: user } = await db
    .from('users')
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();

  if (!user) {
    return jsonResponse(401, { error: 'Usuario o contraseña incorrectos' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return jsonResponse(401, { error: 'Usuario o contraseña incorrectos' });
  }

  if (!user.is_approved) {
    return jsonResponse(403, { error: 'Tu cuenta todavía no ha sido aprobada por el admin' });
  }

  const token = signToken(user);

  return jsonResponse(200, {
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin,
      needs_profile_setup: !user.display_name
    }
  });
};
