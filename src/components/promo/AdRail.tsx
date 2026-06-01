import React, { Suspense } from 'react';
import PromoSlot from './PromoSlot';

interface AdRailProps {
  placement: 'left_rail' | 'right_rail';
}

export default function AdRail({ placement }: AdRailProps) {
  return (
    <div className="hidden lg:flex flex-col gap-3 w-[140px] shrink-0">
      <Suspense fallback={
        <div className="w-full h-[300px] bg-slate-900/50 rounded-xl animate-pulse border border-slate-800" />
      }>
        <PromoSlot placement={placement} variant="rail" />
      </Suspense>
    </div>
  );
}
