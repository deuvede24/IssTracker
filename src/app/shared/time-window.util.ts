// src/app/shared/time-window.util.ts
// UNA SOLA FUENTE DE VERDAD para detectar "noche local"

export function isNightLocal(date: Date, latitude: number): boolean {
  const m = date.getMonth(); // 0-11
  const minutes = date.getHours() * 60 + date.getMinutes();

  // Rango base (verano / latitudes normales): 18:00–07:00
  let start = 18 * 60;
  let end = 7 * 60;

  const isNordic = Math.abs(latitude) > 60;
  const isWinter = latitude < 0
    ? (m >= 5 && m <= 7)        // Jun–Ago hemisferio sur
    : (m >= 10 || m <= 1);      // Nov–Feb hemisferio norte

  if (isNordic && isWinter) {
    start = 14 * 60; end = 9 * 60;
  } else if (isWinter) {
    start = 17 * 60; end = 6 * 60;
  }

  // noche si está en [start, 24h) ∪ [0, end)
  return minutes >= start || minutes < end;
}