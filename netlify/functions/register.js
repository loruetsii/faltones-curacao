const bcrypt = require('bcryptjs');
const { getDb } = require('./utils/db');
const { jsonResponse } = require('./utils/auth');

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

  const { username, password, inviteCode } = body;

  if (!username || !password || !inviteCode) {
    return jsonResponse(400, { error: 'Faltan campos por rellenar' });
  }
  if (username.length < 3) {
    return jsonResponse(400, { error: 'El usuario debe tener al menos 3 caracteres' });
  }
  if (password.length < 6) {
    return jsonResponse(400, { error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const db = getDb();

  const { data: config } = await db
    .from('app_config')
    .select('value')
    .eq('key', 'invite_code')
    .single();

  if (!config || config.value !== inviteCode.trim()) {
    return jsonResponse(400, { error: 'Código de invitación incorrecto' });
  }

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();

  if (existing) {
    return jsonResponse(400, { error: 'Ese nombre de usuario ya está en uso' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { error } = await db.from('users').insert({
    username: username.trim().toLowerCase(),
    password_hash: passwordHash,
    is_admin: false,
    is_approved: false
  });

  if (error) {
    return jsonResponse(500, { error: 'No se pudo crear el usuario' });
  }

  return jsonResponse(200, {
    message: 'Registro correcto. Un admin debe aprobar tu cuenta antes de que puedas entrar.'
  });
};
