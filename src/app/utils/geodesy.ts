/**
 * Convierte grados a cardinal (ej. 315 => "Noroeste")
 */
export function bearingToCardinal(bearing: number): string {
  const directions = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'];
  const index = Math.round(((bearing % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Calcula el bearing (azimut) desde punto A hacia B en grados.
 */
export function calculateBearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  
  return (toDeg(θ) + 360) % 360;
}

/**
 * Coordenadas de lugares conocidos en Barcelona
 */
export const BARCELONA_PLACES: Record<string, [number, number]> = {
  'Hospital Clínic': [2.153, 41.390],
  'Sagrada Família': [2.174, 41.404], 
  'Park Güell': [2.153, 41.414],
  'Port Vell': [2.185, 41.376],
  'Tibidabo': [2.120, 41.422],
  'Barceloneta': [2.197, 41.385]
};