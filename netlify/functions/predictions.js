const { getDb } = require('./utils/db');
const { jsonResponse, requireAuth } = require('./utils/auth');

async function getCurrentMatchday(db) {
  const { data } = await db
    .from('matchdays')
    .select('*')
    .gt('deadline_at', new Date().toISOString())
    .order('deadline_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

exports.handler = async (event) => {
  const { user, error } = requireAuth(event);
  if (error) return error;

  const db = getDb();

  if (event.httpMethod === 'GET') {
    const matchday = await getCurrentMatchday(db);
    if (!matchday) {
      return jsonResponse(200, { matchday: null, matches: [] });
    }

    const { data: matches } = await db
      .from('matches')
      .select(`
        id, kickoff_at, status,
        home_team:home_team_id ( id, name, crest_url, liga_position ),
        away_team:away_team_id ( id, name, crest_url, liga_position )
      `)
      .eq('matchday_id', matchday.id)
      .order('kickoff_at', { ascending: true });

    const { data: myPredictions } = await db
      .from('predictions')
      .select('match_id, home_score_pred, away_score_pred')
      .eq('user_id', user.sub)
      .in('match_id', (matches || []).map(m => m.id));

    const predMap = {};
    (myPredictions || []).forEach(p => { predMap[p.match_id] = p; });

    const matchesOut = (matches || []).map(m => ({
      ...m,
      my_prediction: predMap[m.id] || null
    }));

    return jsonResponse(200, { matchday, matches: matchesOut });
  }

  if (event.httpMethod === 'POST') {
    const matchday = await getCurrentMatchday(db);
    if (!matchday) {
      return jsonResponse(400, { error: 'No hay ninguna jornada abierta ahora mismo' });
    }
    if (new Date(matchday.deadline_at).getTime() <= Date.now()) {
      return jsonResponse(400, { error: 'El plazo para esta jornada ya ha cerrado' });
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return jsonResponse(400, { error: 'Datos inválidos' });
    }

    const { predictions } = body; // [{matchId, home, away}, ...]
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return jsonResponse(400, { error: 'No se han enviado pronósticos' });
    }

    const { data: matches } = await db
      .from('matches')
      .select('id')
      .eq('matchday_id', matchday.id);
    const validIds = new Set((matches || []).map(m => m.id));

    const rows = [];
    for (const p of predictions) {
      if (!validIds.has(p.matchId)) {
        return jsonResponse(400, { error: 'Partido no válido para esta jornada' });
      }
      const home = parseInt(p.home, 10);
      const away = parseInt(p.away, 10);
      if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
        return jsonResponse(400, { error: 'Resultado inválido' });
      }
      rows.push({
        user_id: user.sub,
        match_id: p.matchId,
        home_score_pred: home,
        away_score_pred: away,
        submitted_at: new Date().toISOString()
      });
    }

    const { error: upsertError } = await db
      .from('predictions')
      .upsert(rows, { onConflict: 'user_id,match_id' });
    if (upsertError) {
      return jsonResponse(500, { error: 'No se pudieron guardar los pronósticos' });
    }

    return jsonResponse(200, { message: 'Pronósticos guardados' });
  }

  return jsonResponse(405, { error: 'Método no permitido' });
};
