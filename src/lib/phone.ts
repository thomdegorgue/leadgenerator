/**
 * Normalización de teléfonos argentinos a E.164 móvil (+549 + área + número).
 * Heurística conservadora: si no se puede normalizar con confianza devuelve
 * null y el lead conserva el teléfono crudo (sin clave de dedup por teléfono).
 */
export function normalizePhoneAR(input?: string | null): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("549")) d = d.slice(3);
  else if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);

  // Quitar el "15" de celulares escritos con característica: 11-15-XXXXXXXX
  if (d.length === 12 && d.slice(2, 4) === "15") d = d.slice(0, 2) + d.slice(4);
  else if (d.length === 13 && d.slice(3, 5) === "15") d = d.slice(0, 3) + d.slice(5);
  else if (d.length === 14 && d.slice(4, 6) === "15") d = d.slice(0, 4) + d.slice(6);

  // Formato final esperado: 10 dígitos (área + número)
  if (d.length !== 10) return null;
  return `+549${d}`;
}
