// src/components/broadcast/TrollopolyBoard.tsx
// 3D rotating board for Trollopoly with smooth camera movements

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motion as motion3d } from 'framer-motion';
import { Dice5, DollarSign, Building2, Home, Factory, ShoppingBag, Banknote, Star, Crown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrollopolyMatch, TrollopolyPlayer, TrollopolyProperty } from '@/lib/game/gameTypes';

interface TrollopolyBoardProps {
  match: TrollopolyMatch;
  currentUserId?: string;
  isMyTurn: boolean;
  onRollDice?: () => void;
  onBuyProperty?: (propertyId: number) => void;
}

const BOARD_SPACES = [
  { id: 0, name: 'GO', type: 'special', color: '#FFD700' },
  { id: 1, name: 'Troll Plaza', type: 'city', color: '#8B4513' },
  { id: 2, name: 'Troll Park', type: 'city', color: '#8B4513' },
  { id: 3, name: 'Community Chest', type: 'event', color: '#4A90D9' },
  { id: 4, name: 'Troll Café', type: 'city', color: '#87CEEB' },
  { id: 5, name: 'Troll Taxi', type: 'transport', color: '#666' },
  { id: 6, name: 'Troll Mall', type: 'city', color: '#87CEEB' },
  { id: 7, name: 'Chance', type: 'event', color: '#FF69B4' },
  { id: 8, name: 'Troll Arcade', type: 'city', color: '#87CEEB' },
  { id: 9, name: 'Troll Diner', type: 'city', color: '#FF69B4' },
  { id: 10, name: 'Jail', type: 'special', color: '#FF0000' },
  { id: 11, name: 'Troll Hotel', type: 'city', color: '#FFA500' },
  { id: 12, name: 'Troll Cinema', type: 'city', color: '#FFA500' },
  { id: 13, name: 'Electric Co', type: 'utility', color: '#4A90D9' },
  { id: 14, name: 'Troll Stadium', type: 'city', color: '#FFA500' },
  { id: 15, name: 'Troll Tower', type: 'city', color: '#FF0000' },
  { id: 16, name: 'Troll HQ', type: 'city', color: '#FF0000' },
  { id: 17, name: 'Free Parking', type: 'special', color: '#4A90D9' },
  { id: 18, name: 'Troll Beach', type: 'city', color: '#00FF00' },
  { id: 19, name: 'Troll Resort', type: 'city', color: '#00FF00' },
  { id: 20, name: 'Chance', type: 'event', color: '#FF69B4' },
  { id: 21, name: 'Troll Island', type: 'city', color: '#00FF00' },
  { id: 22, name: 'Troll Port', type: 'transport', color: '#666' },
  { id: 23, name: 'Go to Jail', type: 'special', color: '#FF0000' },
];

const BUILDING_ICONS: Record<string, React.ReactNode> = {
  city: <Building2 className="w-3 h-3" />,
  transport: <ShoppingBag className="w-3 h-3" />,
  utility: <Banknote className="w-3 h-3" />,
  event: <Star className="w-3 h-3" />,
  special: <Crown className="w-3 h-3" />,
};

const PIECE_EMOJI: Record<string, string> = {
  car: '🚗',
  yacht: '⛵',
  jet: '✈️',
  stick_figure: '🚶',
  tree: '🌲',
  troll_character: '👹',
};

export default function TrollopolyBoard({
  match,
  currentUserId,
  isMyTurn,
  onRollDice,
  onBuyProperty,
}: TrollopolyBoardProps) {
  const [boardRotation, setBoardRotation] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [animatedDice, setAnimatedDice] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBoardRotation(match.boardRotation);
  }, [match.boardRotation]);

  const handleDiceRoll = async () => {
    if (!isMyTurn || isRolling) return;
    setIsRolling(true);
    
    // Animate dice
    for (let i = 0; i < 10; i++) {
      setAnimatedDice(Math.floor(Math.random() * 6) + 1);
      await new Promise(r => setTimeout(r, 50));
    }
    
    const finalDice = match.lastDiceRoll || Math.floor(Math.random() * 6) + 1;
    setAnimatedDice(finalDice);
    setIsRolling(false);
    
    onRollDice?.();
  };

  const currentPlayer = match.players[match.currentTurnIndex];

  return (
    <div className="relative w-full h-full min-h-[500px] flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-4 overflow-hidden">
      {/* 3D Board Container */}
      <motion3d.div
        ref={boardRef}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: boardRotation }}
        transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        className="relative w-full max-w-lg aspect-square"
        style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      >
        {/* Board Base */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-800 to-amber-900 rounded-3xl border-4 border-amber-600 shadow-2xl overflow-hidden" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(20deg)' }}>
          {/* Inner Board */}
          <div className="absolute inset-4 bg-green-800 rounded-2xl border-2 border-green-700">
            {/* Board Grid */}
            <div className="absolute inset-8 grid grid-cols-11 gap-0.5">
              {/* Top Row (0-10) */}
              {BOARD_SPACES.slice(0, 11).map((space, i) => {
                const property = match.properties.find(p => p.id === space.id);
                const owners = match.players.filter(p => p.position === space.id);
                
                return (
                  <div
                    key={`top-${i}`}
                    className="relative border border-white/20 bg-cover bg-center"
                    style={{ 
                      backgroundColor: space.color,
                      gridColumn: i + 1,
                      gridRow: 1,
                    }}
                  >
                    {property && property.ownerId && (
                      <div 
                        className="absolute bottom-0 left-0 right-0 h-1"
                        style={{ backgroundColor: match.players.find(p => p.id === property.ownerId)?.id === currentUserId ? '#10B981' : '#EF4444' }}
                      />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                      <span className="text-[6px] font-bold text-white truncate w-full text-center leading-tight">{space.name}</span>
                      {property && property.price > 0 && (
                        <span className="text-[5px] text-white/80">{property.price}</span>
                      )}
                    </div>
                    {/* Players on this space */}
                    {owners.map(p => (
                      <div 
                        key={p.id} 
                        className="absolute w-2 h-2 rounded-full border border-white"
                        style={{ 
                          backgroundColor: p.id === currentUserId ? '#10B981' : '#F59E0B',
                          top: '50%',
                          left: `${(owners.indexOf(p) * 25) + 12.5}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        title={p.username}
                      />
                    ))}
                  </div>
                );
              })}
              
              {/* Right Column (11-20) */}
              {BOARD_SPACES.slice(11, 21).map((space, i) => {
                const property = match.properties.find(p => p.id === space.id);
                const owners = match.players.filter(p => p.position === space.id);
                
                return (
                  <div
                    key={`right-${i}`}
                    className="relative border border-white/20"
                    style={{ 
                      backgroundColor: space.color,
                      gridColumn: 11,
                      gridRow: i + 2,
                    }}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                      <span className="text-[6px] font-bold text-white truncate w-full text-center leading-tight">{space.name}</span>
                    </div>
                    {owners.map(p => (
                      <div 
                        key={p.id} 
                        className="absolute w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: p.id === currentUserId ? '#10B981' : '#F59E0B',
                          left: '50%',
                          top: `${(owners.indexOf(p) * 25) + 12.5}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    ))}
                  </div>
                );
              })}
              
              {/* Bottom Row (21-23, reversed) */}
              {[...BOARD_SPACES.slice(21, 24)].reverse().map((space, i) => {
                const property = match.properties.find(p => p.id === space.id);
                const owners = match.players.filter(p => p.position === space.id);
                
                return (
                  <div
                    key={`bottom-${i}`}
                    className="relative border border-white/20"
                    style={{ 
                      backgroundColor: space.color,
                      gridColumn: 10 - i,
                      gridRow: 11,
                    }}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                      <span className="text-[6px] font-bold text-white truncate w-full text-center leading-tight">{space.name}</span>
                    </div>
                    {owners.map(p => (
                      <div 
                        key={p.id} 
                        className="absolute w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: p.id === currentUserId ? '#10B981' : '#F59E0B',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    ))}
                  </div>
                );
              })}
              
              {/* Left Column (24, then 1-10 reversed from bottom) */}
              {[BOARD_SPACES[23], ...[...BOARD_SPACES.slice(1, 11)].reverse()].map((space, i) => {
                const property = match.properties.find(p => p.id === space.id);
                const owners = match.players.filter(p => p.position === space.id);
                
                return (
                  <div
                    key={`left-${i}`}
                    className="relative border border-white/20"
                    style={{ 
                      backgroundColor: space.color,
                      gridColumn: 1,
                      gridRow: 10 - i + 1,
                    }}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                      <span className="text-[6px] font-bold text-white truncate w-full text-center leading-tight">{space.name}</span>
                    </div>
                    {owners.map(p => (
                      <div 
                        key={p.id} 
                        className="absolute w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: p.id === currentUserId ? '#10B981' : '#F59E0B',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            
            {/* Center area - decoration */}
            <div className="absolute inset-12 flex items-center justify-center">
              <div className="text-center">
                <Dice5 className="w-16 h-16 text-amber-500/30 mx-auto mb-2" />
                <span className="text-2xl font-black text-amber-500/30 uppercase tracking-widest">Trollopoly</span>
              </div>
            </div>
          </div>
        </div>
      </motion3d.div>

      {/* Dice Display */}
      <AnimatePresence>
        {match.lastDiceRoll && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            className="absolute top-4 right-4 w-20 h-20 bg-white rounded-xl shadow-lg flex items-center justify-center"
          >
            <span className="text-4xl font-black text-gray-800">{animatedDice || match.lastDiceRoll}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Player Indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur rounded-xl">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-bold text-white">
          {currentPlayer ? `${currentPlayer.username}'s turn` : 'Waiting...'}
        </span>
      </div>

      {/* Action Button */}
      {isMyTurn && match.status === 'active' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <button
            onClick={handleDiceRoll}
            disabled={isRolling}
            className={cn(
              'px-8 py-4 rounded-2xl font-black text-lg uppercase tracking-wider transition-all shadow-2xl',
              isRolling 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 hover:scale-105'
            )}
          >
            {isRolling ? (
              <span className="flex items-center gap-2">
                <Dice5 className="w-5 h-5 animate-spin" />
                Rolling...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Dice5 className="w-5 h-5" />
                Roll Dice
              </span>
            )}
          </button>
        </div>
      )}

      {/* Player Pieces on Board - 3D Layered */}
      <div className="absolute inset-0 pointer-events-none" style={{ perspective: '800px' }}>
        {match.players.map((player, index) => {
          if (!player.piece) return null;
          
          // Calculate position based on board rotation
          const angle = (player.position / 24) * 360;
          const isCurrentPlayer = index === match.currentTurnIndex;
          
          return (
            <motion.div
              key={player.id}
              initial={{ scale: 0 }}
              animate={{ 
                scale: isCurrentPlayer ? 1.2 : 1,
                y: isCurrentPlayer ? -10 : 0,
              }}
              className={cn(
                'absolute w-12 h-12 flex items-center justify-center rounded-full border-2 shadow-lg',
                isCurrentPlayer 
                  ? 'border-amber-400 bg-amber-500/80 z-20' 
                  : 'border-white bg-white/80 z-10'
              )}
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-180px) rotate(${-angle}deg)`,
              }}
              title={player.username}
            >
              <span className="text-2xl">{PIECE_EMOJI[player.piece]}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}