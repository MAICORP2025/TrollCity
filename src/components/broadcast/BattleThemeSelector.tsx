import React from 'react';
import { BATTLE_THEMES } from '../../lib/battleThemes';
import { cn } from '../../lib/utils';

interface BattleThemeSelectorProps {
  selectedTheme: string;
  onSelectTheme: (themeId: string) => void;
  disabled?: boolean;
}

export default function BattleThemeSelector({
  selectedTheme,
  onSelectTheme,
  disabled = false,
}: BattleThemeSelectorProps) {
  return (
    <div className="bg-white/5 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-bold text-white">Battle Background Theme</div>
          <div className="text-[10px] text-zinc-400">Shown to both broadcasters and viewers</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {BATTLE_THEMES.map((theme) => {
          const isActive = selectedTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTheme(theme.id)}
              className={cn(
                'rounded-lg border p-1.5 text-left transition-all',
                isActive ? 'border-amber-400/70 bg-amber-500/10' : 'border-white/10 bg-black/20 hover:border-white/30',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
            >
              <div className={cn('h-12 rounded-md mb-1.5 overflow-hidden relative', theme.previewClassName)}>
                {theme.isFree && (
                  <span className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-white font-bold">
                    Free
                  </span>
                )}
              </div>
              <div className="text-[11px] font-semibold text-white truncate">{theme.label}</div>
              <div className="text-[10px] text-zinc-400 truncate">{theme.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
