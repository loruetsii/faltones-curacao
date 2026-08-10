const { getDb } = require('./utils/db');
const { jsonResponse, requireAdmin } = require('./utils/auth');
const { calcPoints } = require('./utils/scoring');

exports.handler = async (event) => {
  const { error } = requireAdmin(event);
  if (error) return error;

  const db = getDb();

  const res = await fetch('https://api.football-data.org/v4/competitions/PD/matches?season=2026&status=FINISHED', {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY }
  });

  if (!res.ok) {
    return jsonResponse(502, { error: `Error al consultar football-data.org (${res.status})` });
  }

  const data = await res.json();
  const finishedMatches = data.matches || [];

  let updated = 0;
  let pointsCalculated = 0;

  for (const m of finishedMatches) {
    const homeScore = m.score?.fullTime?.home;
    const awayScore = m.score?.fullTime?.away;
    if (homeScore == null || awayScore == null) continue;

    const { data: existingMatch } = await db
      .from('matches')
      .select('id, status, home_score, away_score')
      .eq('api_match_id', m.id)
      .maybeSingle();

    if (!existingMatch) continue;

    const alreadyScored = existingMatch.status === 'finished'
      && existingMatch.home_score === homeScore
      && existingMatch.away_score === awayScore;

    await db.from('matches').update({
      status: 'finished',
      home_score: homeScore,
      away_score: awayScore
    }).eq('id', existingMatch.id);
    updated++;

    if (alreadyScored) continue; // ya se habían calculado los puntos antes

    const { data: preds } = await db
      .from('predictions')
      .select('id, home_score_pred, away_score_pred')
      .eq('match_id', existingMatch.id);

    for (const p of (preds || [])) {
      const points = calcPoints(p.home_score_pred, p.away_score_pred, homeScore, awayScore);
      await db.from('predictions').update({ points }).eq('id', p.id);
      pointsCalculated++;
    }
  }

  return jsonResponse(200, {
    message: `${updated} partidos actualizados, ${pointsCalculated} pronósticos puntuados`
  });
};
