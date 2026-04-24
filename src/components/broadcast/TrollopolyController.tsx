// src/components/broadcast/TrollopolyController.tsx
// Controller panel for Trollopoly (host only)

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Trophy, Settings, Users, Dice5, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrollopolyMatch } from '@/lib/game/gameTypes';

interface TrollopolyControllerProps {
  match: TrollopolyMatch | null;
  onStartGame?: () => void;
  onEndGame?: () => void;
  onResetGame?: () => void;
  onClose?: () => void;
}

export default function TrollopolyController({
  match,
  onStartGame,
  onEndGame,
  onResetGame,
  onClose,
}: TrollopolyControllerProps) {
  if (!match) return null;

  const isLobby = match.phase === 'lobby';
  const isPlaying = match.phase === 'playing';
  const currentPlayer = match.players[match.currentTurnIndex];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="w-72 bg-zinc-900/98 backdrop-blur-2xl border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-amber-900/30 to-orange-900/30">
        <div className="flex items-center gap-2">
          <Dice5 size={16} className="text-amber-400" />
          <span className="text-sm font-black text-white uppercase tracking-wider">Trollopoly</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50 uppercase tracking-wider">Status</span>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
            match.status === 'active' ? 'bg-green-500/20 text-green-400' :
            match.status === 'finished' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          )}>
            {match.status}
          </span>
        </div>

        {/* Players count */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50 uppercase tracking-wider">Players</span>
          <span className="text-sm font-bold text-white">{match.players.length}/6</span>
        </div>

        {/* Current turn */}
        {isPlaying && currentPlayer && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 uppercase tracking-wider">Current Turn</span>
            <span className="text-sm font-bold text-amber-400">{currentPlayer.username}</span>
          </div>
        )}

        {/* Last dice roll */}
        {match.lastDiceRoll && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 uppercase tracking-wider">Last Roll</span>
            <span className="text-lg font-black text-white">{match.lastDiceRoll}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          {isLobby && match.players.length >= 2 && (
            <button
              onClick={onStartGame}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-xl text-green-400 font-bold text-sm transition-all"
            >
              <Play size={14} />
              Start Game
            </button>
          )}

          {isPlaying && (
            <button
              onClick={onEndGame}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl text-red-400 font-bold text-sm transition-all"
            >
              <Trophy size={14} />
              End Game
            </button>
          )}

          <button
            onClick={onResetGame}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white/70 font-bold text-sm transition-all"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        {/* Player list */}
        <div className="pt-2 border-t border-white/10">
          <span className="text-xs text-white/50 uppercase tracking-wider block mb-2">Players</span>
          <div className="space-y-1">
            {match.players.map((player, index) => (
              <div 
                key={player.id}
                className={cn(
                  'flex items-center justify-between px-2 py-1 rounded-lg',
                  index === match.currentTurnIndex && isPlaying ? 'bg-amber-500/10' : 'bg-white/5'
                )}
              >
                <span className="text-sm text-white/80 truncate">{player.username}</span>
                <span className="text-xs text-amber-400 font-bold">{player.balance}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}