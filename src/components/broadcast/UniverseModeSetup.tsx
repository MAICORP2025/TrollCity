import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Swords, Users, Trophy } from 'lucide-react';

type UniverseTab = 'multi' | 'troll';

interface UniverseModeSetupProps {
  onBattleStart: (mode: 'multi' | 'troll', format?: '1v1' | '2v2' | '3v3' | '4v4') => void;
  disabled?: boolean;
}

export default function UniverseModeSetup({ onBattleStart, disabled = false }: UniverseModeSetupProps) {
  const [activeTab, setActiveTab] = useState<UniverseTab>('troll');
  const [selectedFormat, setSelectedFormat] = useState<'1v1' | '2v2' | '3v3' | '4v4'>('4v4');

  const handleStartMultiBattle = (format: '1v1' | '2v2' | '3v3' | '4v4') => {
    setSelectedFormat(format);
    onBattleStart('multi', format);
  };

  const handleStartTrollBattle = () => {
    onBattleStart('troll', '4v4');
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('multi')}
          className={cn(
            "px-4 py-2 text-sm font-bold transition-all relative",
            activeTab === 'multi'
              ? "text-amber-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <span className="flex items-center gap-2">
            <Swords size={16} />
            Multi Battle
          </span>
          {activeTab === 'multi' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('troll')}
          className={cn(
            "px-4 py-2 text-sm font-bold transition-all relative",
            activeTab === 'troll'
              ? "text-purple-400"
              : "text-gray-400 hover:text-gray-300"
          )}
        >
          <span className="flex items-center gap-2">
            <Trophy size={16} />
            Troll Battle
          </span>
          {activeTab === 'troll' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
          )}
        </button>
      </div>

      {/* Multi Battle Tab */}
      {activeTab === 'multi' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Users size={16} className="text-amber-400" />
            <span className="text-gray-300">Select team size and challenge another broadcaster</span>
          </div>

          {/* Format Selector */}
          <div className="grid grid-cols-4 gap-2">
            {(['1v1', '2v2', '3v3', '4v4'] as const).map((format) => (
              <button
                key={format}
                onClick={() => handleStartMultiBattle(format)}
                disabled={disabled}
                className={cn(
                  "py-2 rounded-lg text-sm font-bold transition-all",
                  "border",
                  selectedFormat === format && activeTab === 'multi'
                    ? "bg-amber-500/20 border-amber-500 text-amber-400"
                    : "border-white/10 text-gray-300 hover:border-amber-500/50 hover:text-amber-400",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {format}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 px-1">
            Reuses existing battle system. Challenge another broadcaster in your format.
          </p>
        </div>
      )}

      {/* Troll Battle Tab */}
      {activeTab === 'troll' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Trophy size={16} className="text-purple-400" />
            <span className="text-gray-300">4v4 competitive battle with crown rewards</span>
          </div>

          {/* Fixed 4v4 Format */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-purple-300">4v4 Troll Battle</span>
              <span className="text-xs px-2 py-1 bg-purple-500/30 rounded text-purple-200">
                Fixed Format
              </span>
            </div>
            
<ul className="text-xs text-gray-300 space-y-1 px-2">
               <li>✓ 8 seated participants (4 per team)</li>
               <li>✓ 3-minute duration with real-time scoring</li>
               <li>✓ Gifts directly increase team score</li>
               <li>✓ Winners earn crowns + 2% coin bonus</li>
               <li>✓ Viewers watch via HLS playback</li>
             </ul>

            <button
              onClick={handleStartTrollBattle}
              disabled={disabled}
              className={cn(
                "mt-3 w-full py-2 rounded-lg font-bold transition-all text-sm",
                "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500",
                "text-white border border-purple-400/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              Start 4v4 Troll Battle
            </button>
          </div>

          <p className="text-xs text-gray-400 px-1">
            Real-time competitive streaming with tournament-style rewards.
          </p>
        </div>
      )}
    </div>
  );
}
