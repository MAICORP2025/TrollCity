import React, { useEffect, useRef } from 'react';

export default function CarOnPath({ pathId, color = '#ff6b6b', offset = 0, speed = 1.6 }: { pathId: string; color?: string; offset?: number; speed?: number }) {
  const gRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const el = document.getElementById(pathId) as SVGPathElement | null;
    const g = gRef.current;
    if (!el || !g) return;

    const path = el;

    let length = path.getTotalLength();
    let t = (offset / 100) * length;
    let raf = 0;

    const step = () => {
      t += speed;
      if (t > length) t = 0;
      const p = path.getPointAtLength(t);
      const delta = 2;
      const nextT = (t + delta) % length;
      const next = path.getPointAtLength(nextT);
      const angle = Math.atan2(next.y - p.y, next.x - p.x) * (180 / Math.PI);
      g.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${angle})`);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);

    const onResize = () => {
      length = path.getTotalLength();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [pathId, offset, speed]);

  // Simple car silhouette using SVG rect/rounded corners so rotation looks natural
  return (
    <g ref={gRef} filter="url(#shadow)">
      <rect x={-12} y={-6} width={24} height={12} rx={3} fill={color} stroke="#0b1220" strokeWidth={1.5} />
      <circle cx={-6} cy={6} r={2.8} fill="#0b1220" />
      <circle cx={6} cy={6} r={2.8} fill="#0b1220" />
    </g>
  );
}

