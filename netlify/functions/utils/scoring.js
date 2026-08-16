// Calcula los puntos de un pronóstico según el resultado real.
// Reglas:
//  - Resultado exacto: 6 puntos (fijo)
//  - Si no es exacto pero acierta la diferencia de goles: 2 puntos por la diferencia
//    + 1 punto por el ganador (acertar la diferencia implica acertar el ganador) = 3 puntos
//  - Si no acierta la diferencia pero sí el ganador (o el empate): 1 punto
//  - Si no acierta nada: 0 puntos
function calcPoints(predHome, predAway, actualHome, actualAway) {
  if (predHome === actualHome && predAway === actualAway) return 6;

  const predDiff = predHome - predAway;
  const actualDiff = actualHome - actualAway;

  if (predDiff === actualDiff) return 3; // 2 (diferencia) + 1 (ganador)

  const predSign = Math.sign(predDiff);
  const actualSign = Math.sign(actualDiff);
  if (predSign === actualSign) return 1; // solo ganador

  return 0;
}

module.exports = { calcPoints };
