const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');

// Genera una contraseña temporal fácil de dictar/copiar: 6 caracteres, sin
// letras ni números ambiguos (0/O, 1/l/I).
function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length];
  return out;
}

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

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const db = getDb();
  const { error: updateError } = await db
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', userId);

  if (updateError) return jsonResponse(500, { error: 'No se pudo restablecer la contraseña' });

  return jsonResponse(200, { message: 'Contraseña restablecida', tempPassword });
};
