// Calcula los puntos de un pronóstico según el resultado real.
// Reglas:
//  - Resultado exacto: 6 puntos
//  - Si no es exacto pero acierta la diferencia de goles: 1 punto
//    (y esto implica automáticamente acertar también el ganador)
//  - Si no acierta la diferencia pero sí el ganador (o el empate): 1 punto
//  - Si no acierta nada: 0 puntos
function calcPoints(predHome, predAway, actualHome, actualAway) {
  if (predHome === actualHome && predAway === actualAway) return 6;

  const predDiff = predHome - predAway;
  const actualDiff = actualHome - actualAway;

  if (predDiff === actualDiff) return 2; // acierta diferencia + ganador

  const predSign = Math.sign(predDiff);
  const actualSign = Math.sign(actualDiff);
  if (predSign === actualSign) return 1; // acierta solo el ganador

  return 0;
}

module.exports = { calcPoints };
