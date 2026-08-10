const jwt = require('jsonwebtoken');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, is_admin: user.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '60d' }
  );
}

// Extrae y valida el usuario a partir de la cabecera Authorization.
// Devuelve null si no hay token válido.
function getUserFromEvent(event) {
  const header = event.headers.authorization || event.headers.Authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function requireAuth(event) {
  const user = getUserFromEvent(event);
  if (!user) {
    return { error: jsonResponse(401, { error: 'No autenticado' }) };
  }
  return { user };
}

function requireAdmin(event) {
  const { user, error } = requireAuth(event);
  if (error) return { error };
  if (!user.is_admin) {
    return { error: jsonResponse(403, { error: 'Solo el admin puede hacer esto' }) };
  }
  return { user };
}

module.exports = { signToken, getUserFromEvent, jsonResponse, requireAuth, requireAdmin };
