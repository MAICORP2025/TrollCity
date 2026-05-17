// src/components/broadcast/TrollopolyLobby.tsx
// Lobby component for Trollopoly with 20-second join countdown

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Clock, Trophy, Dice5, Car, Anchor, Plane, User, TreeDeciduous, Skull, X, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrollopolyPiece } from '@/lib/game/gameTypes';
import type { TrollopolyMatch } from '@/stores/trollopolyStore';
import { AVAILABLE_PIECES } from '@/stores/trollopolyStore';

interface TrollopolyLobbyProps {
  match: TrollopolyMatch | null;
  isHost: boolean;
  currentUserId?: string;
  availablePieces: TrollopolyPiece[];
  onJoin?: () => void;
  onLeave?: () => void;
  onSelectPiece?: (piece: TrollopolyPiece) => void;
  onStartGame?: () => void;
  onClose?: () => void;
}

const PIECE_ICONS: Record<TrollopolyPiece, React.ReactNode> = {
  car: <Car className="w-5 h-5" />,
  yacht: <Anchor className="w-5 h-5" />,
  jet: <Plane className="w-5 h-5" />,
  stick_figure: <User className="w-5 h-5" />,
  tree: <TreeDeciduous className="w-5 h-5" />,
  troll_character: <Skull className="w-5 h-5" />,
};

const PIECE_NAMES: Record<TrollopolyPiece, string> = {
  car: 'Car',
  yacht: 'Yacht',
  jet: 'Jet',
  stick_figure: 'Stick Figure',
  tree: 'Tree',
  troll_character: 'Troll',
};

export default function TrollopolyLobby({
  match,
  isHost,
  currentUserId,
  availablePieces,
  onJoin,
  onLeave,
  onSelectPiece,
  onStartGame,
  onClose,
}: TrollopolyLobbyProps) {
  if (!match) return null;

  const isInGame = match.players.some(p => p.id === currentUserId);
  const currentPlayer = match.players[0];
  const isPieceSelection = match.phase === 'piece_selection';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl max-h-[94dvh] overflow-y-auto">
        <div className="bg-gradient-to-br from-amber-900/90 via-zinc-900/95 to-orange-900/90 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-white/10 bg-gradient-to-r from-amber-600/20 to-orange-600/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                  <Dice5 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider">Trollopoly</h2>
                  <p className="text-xs text-amber-300/70">Monopoly-style board game</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Countdown timer */}
                {match.phase === 'lobby' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-xl">
                    <Clock className="w-4 h-4 text-red-400" />
                    <span className="text-lg font-black text-red-400">{match.countdownRemaining}s</span>
                  </div>
                )}
                
                {onClose && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white/70" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Game phase info */}
            <div className="mb-6 text-center">
              {match.phase === 'lobby' ? (
                <p className="text-lg font-bold text-white">
                  Join the game! <span className="text-amber-400">{match.countdownRemaining}</span> seconds remaining
                </p>
              ) : isPieceSelection ? (
                <p className="text-lg font-bold text-white">Select your game piece</p>
              ) : (
                <p className="text-lg font-bold text-white">Game starting...</p>
              )}
            </div>

            {/* Player slots */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {Array.from({ length: 4 }).map((_, index) => {
                const player = match.players[index];
                const isEmpty = !player;
                const isHostSlot = index === 0;
                const isMySlot = player?.id === currentUserId;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      'relative p-4 rounded-2xl border-2 transition-all',
                      isEmpty 
                        ? 'border-dashed border-white/20 bg-white/5' 
                        : isMySlot
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-white/20 bg-white/10'
                    )}
                  >
                    {isEmpty ? (
                      <div className="flex flex-col items-center justify-center py-4">
                        <Users className="w-8 h-8 text-white/30 mb-2" />
                        <span className="text-xs text-white/40 font-medium">
                          {isHostSlot ? 'Host' : `Slot ${index + 1}`}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        {/* Player piece icon */}
                        <div className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center mb-2',
                          isHostSlot ? 'bg-purple-500/30' : 'bg-amber-500/30'
                        )}>
                          {player.piece ? (
                            <span className="text-2xl">
                              {PIECE_ICONS[player.piece]}
                            </span>
                          ) : (
                            <User className="w-6 h-6 text-white/70" />
                          )}
                        </div>
                        
                        {/* Player name */}
                        <span className="text-sm font-bold text-white truncate w-full text-center">
                          {player.username}
                        </span>
                        
                        {/* Host badge */}
                        {isHostSlot && (
                          <span className="mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-purple-500/20 text-purple-300 uppercase">
                            Host
                          </span>
                        )}
                        
                        {/* Balance */}
                        <span className="mt-1 text-xs text-amber-400 font-bold">
                          {player.balance} coins
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-4">
              {!isInGame && match.phase === 'lobby' && (
                <button
                  onClick={onJoin}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-xl font-bold text-white shadow-lg transition-all"
                >
                  Join Game
                </button>
              )}
              
              {isInGame && match.phase === 'lobby' && (
                <button
                  onClick={onLeave}
                  className="px-8 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl font-bold text-red-400 transition-all"
                >
                  Leave Game
                </button>
              )}

              {isPieceSelection && isInGame && !match.players.find(p => p.id === currentUserId)?.piece && (
                <div className="w-full">
                  <p className="text-sm text-white/70 mb-3 text-center">Choose your piece:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {AVAILABLE_PIECES.map(piece => {
                      const isAvailable = availablePieces.includes(piece);
                      return (
                        <button
                          key={piece}
                          onClick={() => isAvailable && onSelectPiece?.(piece)}
                          disabled={!isAvailable}
                          className={cn(
                            'px-4 py-2 rounded-lg flex items-center gap-2 transition-all',
                            isAvailable
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-white'
                              : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                          )}
                        >
                          {PIECE_ICONS[piece]}
                          <span className="text-sm font-medium">{PIECE_NAMES[piece]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isHost && match.phase === 'piece_selection' && match.players.length >= 1 && (
                <button
                  onClick={onStartGame}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2"
                >
                  <Trophy className="w-5 h-5" />
                  Start Game
                </button>
              )}
            </div>

            {/* Player count */}
            <div className="mt-6 text-center">
              <span className="text-sm text-white/50">
                {match.players.length} / 4 players joined
                {match.phase === 'lobby' && match.players.length < 1 && (
                  <span className="text-amber-400 ml-2">Need at least 1 player to start</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
