/**
 * Isologo de Farmatodo redibujado en SVG a partir de la imagen compartida por RH.
 * Si se cuenta con el archivo oficial, reemplazar este componente por <img src="logo.svg">.
 */

const NAVY = '#0f2a78';

/** Pétalo en forma de gota: punta en (tx, ty), parte redonda centrada en (cx, cy) con radio r. */
function drop(tx: number, ty: number, cx: number, cy: number, r: number) {
  const d = Math.hypot(tx - cx, ty - cy);
  const phi = Math.atan2(ty - cy, tx - cx);
  const a = Math.acos(r / d);
  const p1 = [cx + r * Math.cos(phi + a), cy + r * Math.sin(phi + a)];
  const p2 = [cx + r * Math.cos(phi - a), cy + r * Math.sin(phi - a)];
  const f = (n: number) => n.toFixed(2);
  return `M${f(tx)} ${f(ty)} L${f(p1[0])} ${f(p1[1])} A${r} ${r} 0 1 1 ${f(p2[0])} ${f(p2[1])} Z`;
}

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Farmatodo">
      <rect width="100" height="100" fill={NAVY} />
      <circle cx="2" cy="104" r="64" fill="#fff" />
      <path d={drop(58, 51, 38, 25, 13)} fill="#fff" />
      <path d={drop(60, 50, 73, 23, 13.5)} fill="#fff" />
      <path d={drop(50, 58, 17, 53, 11)} fill={NAVY} />
      <path d={drop(52, 63, 28, 80, 10)} fill={NAVY} />
    </svg>
  );
}
