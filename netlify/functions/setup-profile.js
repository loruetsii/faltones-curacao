const { getDb } = require('./utils/db');
const { jsonResponse, requireAuth } = require('./utils/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido' });
  }

  const { user, error } = requireAuth(event);
  if (error) return error;

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return jsonResponse(400, { error: 'Datos inválidos' });
  }

  const { displayName, avatarBase64 } = body;
  if (!displayName || !displayName.trim()) {
    return jsonResponse(400, { error: 'El nombre/apodo es obligatorio' });
  }

  const db = getDb();
  const updates = { display_name: displayName.trim() };

  if (avatarBase64) {
    const matches = avatarBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) {
      return jsonResponse(400, { error: 'Imagen no válida' });
    }
    const mime = matches[1];
    const ext = mime.split('/')[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const path = `${user.sub}.${ext}`;

    const { error: uploadError } = await db.storage
      .from('avatars')
      .upload(path, buffer, { contentType: mime, upsert: true });

    if (uploadError) {
      return jsonResponse(500, { error: 'No se pudo subir la imagen' });
    }

    const { data: publicUrl } = db.storage.from('avatars').getPublicUrl(path);
    updates.avatar_url = publicUrl.publicUrl;
  }

  const { error: updateError } = await db
    .from('users')
    .update(updates)
    .eq('id', user.sub);

  if (updateError) {
    return jsonResponse(500, { error: 'No se pudo guardar el perfil' });
  }

  return jsonResponse(200, { message: 'Perfil guardado', avatar_url: updates.avatar_url || null });
};
