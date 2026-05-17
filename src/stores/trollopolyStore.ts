import { create } from 'zustand';
import type { TrollopolyPlayer, TrollopolyProperty, TrollopolyPhase, TrollopolyPiece } from '../lib/game/gameTypes';
import { TROLLOPOLY_PROPERTIES as CITY_TROLLOPOLY_PROPERTIES } from '../lib/game/types/TrollopolyTypes';

interface TrollopolyConfig {
  minPlayers: number;
  maxPlayers: number;
  startingBalance: number;
  joinCountdown: number;
  turnTimeLimit: number;
  propertyGroups: Record<string, { color: string; properties: number[] }>;
}

export const DEFAULT_TROLLOPOLY_CONFIG: TrollopolyConfig = {
  minPlayers: 1,
  maxPlayers: 4,
  startingBalance: 2000,
  joinCountdown: 20,
  turnTimeLimit: 30,
  propertyGroups: {
    brown: { color: '#8B4513', properties: [1, 2] },
    lightBlue: { color: '#87CEEB', properties: [3, 4, 5] },
    pink: { color: '#FF69B4', properties: [6, 7, 8] },
    orange: { color: '#FFA500', properties: [9, 10, 11] },
    red: { color: '#FF0000', properties: [12, 13, 14] },
    yellow: { color: '#FFFF00', properties: [15, 16, 17] },
    green: { color: '#00FF00', properties: [18, 19, 20] },
    blue: { color: '#0000FF', properties: [21, 22] },
  },
};

const TROLLOPOLY_PROPERTIES: TrollopolyProperty[] = CITY_TROLLOPOLY_PROPERTIES.map((property) => ({
  id: property.id,
  name: property.name,
  type: property.type === 'utility' || property.type === 'transport' ? property.type : property.type === 'special' ? 'event' : 'city',
  price: property.price,
  rent: property.baseRent,
  ownerId: null,
  buildingLevel: 0,
  group: property.color,
}));

export const AVAILABLE_PIECES: TrollopolyPiece[] = ['car', 'yacht', 'jet', 'stick_figure', 'tree', 'troll_character'];

export interface TrollopolyMatch {
  id: string;
  streamId: string;
  status: 'lobby' | 'piece_selection' | 'playing' | 'active' | 'finished';
  phase: TrollopolyPhase;
  players: TrollopolyPlayer[];
  currentTurnIndex: number;
  countdownRemaining: number;
  boardRotation: number;
  lastDiceRoll: number | null;
  properties: TrollopolyProperty[];
  winnerId: string | null;
  createdAt: string;
  updatedAt: string;
  gameBalance: number;
}

interface TrollopolyStore {
  match: TrollopolyMatch | null;
  config: TrollopolyConfig;
  isControllerOpen: boolean;
  viewerStatus: 'none' | 'lobby' | 'playing' | 'finished';
  availablePieces: TrollopolyPiece[];
  
  setMatch: (match: TrollopolyMatch | null) => void;
  setConfig: (config: Partial<TrollopolyConfig>) => void;
  setControllerOpen: (open: boolean) => void;
  setViewerStatus: (status: 'none' | 'lobby' | 'playing' | 'finished') => void;
  
  createMatch: (streamId: string, hostId: string, hostUsername: string) => void;
  startCountdown: () => void;
  tickCountdown: () => void;
  addPlayer: (player: TrollopolyPlayer) => void;
  removePlayer: (playerId: string) => void;
  setPlayerPiece: (playerId: string, piece: TrollopolyPiece) => void;
  updatePlayerBalance: (playerId: string, newBalance: number) => void;
  updateGameBalance: (amount: number) => void;
  addCoinsToGame: (playerId: string, amount: number) => Promise<boolean>;
  startGame: () => void;
  rollDice: () => number;
  movePlayer: (playerId: string, spaces: number) => void;
  nextTurn: () => void;
  buyProperty: (playerId: string, propertyId: number) => boolean;
  payRent: (fromPlayerId: string, toPlayerId: string, amount: number) => boolean;
  endGame: (winnerId: string) => void;
  resetMatch: () => void;
}

export const useTrollopolyStore = create<TrollopolyStore>((set, get) => ({
  match: null,
  config: DEFAULT_TROLLOPOLY_CONFIG,
  isControllerOpen: false,
  viewerStatus: 'none',
  availablePieces: [...AVAILABLE_PIECES],
  
  setMatch: (match) => set({ match }),
  setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),
  setControllerOpen: (open) => set({ isControllerOpen: open }),
  setViewerStatus: (status) => set({ viewerStatus: status }),
  
  createMatch: (streamId, hostId, hostUsername) => {
    const hostPlayer: TrollopolyPlayer = {
      id: hostId,
      username: hostUsername,
      piece: null,
      balance: DEFAULT_TROLLOPOLY_CONFIG.startingBalance,
      position: 0,
      isBankrupt: false,
      isConnected: true,
    };
    
    const match: TrollopolyMatch = {
      id: `trollopoly-${streamId}-${Date.now()}`,
      streamId,
      status: 'lobby',
      phase: 'lobby',
      players: [hostPlayer],
      currentTurnIndex: 0,
      countdownRemaining: DEFAULT_TROLLOPOLY_CONFIG.joinCountdown,
      boardRotation: 0,
      lastDiceRoll: null,
      properties: [...TROLLOPOLY_PROPERTIES],
      winnerId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      gameBalance: 0,
    };
    
    set({ 
      match, 
      availablePieces: [...AVAILABLE_PIECES],
      viewerStatus: 'lobby'
    });
  },
  
  startCountdown: () => {
    const { match } = get();
    if (!match) return;
    set({
      match: { 
        ...match, 
        phase: 'lobby',
        countdownRemaining: DEFAULT_TROLLOPOLY_CONFIG.joinCountdown 
      }
    });
  },
  
  tickCountdown: () => {
    const { match } = get();
    if (!match || match.countdownRemaining <= 0) return;
    
    const newCountdown = match.countdownRemaining - 1;
    
    if (newCountdown <= 0) {
      if (match.players.length >= DEFAULT_TROLLOPOLY_CONFIG.minPlayers) {
        set({
          match: {
            ...match,
            countdownRemaining: 0,
            status: 'lobby',
            phase: 'piece_selection',
          }
        });
      } else {
        set({
          match: {
            ...match,
            countdownRemaining: 0,
            status: 'finished',
            phase: 'finished',
          }
        });
      }
    } else {
      set({
        match: { ...match, countdownRemaining: newCountdown }
      });
    }
  },
  
  addPlayer: (player) => {
    const { match, config } = get();
    if (!match || match.players.length >= config.maxPlayers) return;
    if (match.players.some(p => p.id === player.id)) return;

    const newPlayers = [...match.players, player];
    set({
      match: {
        ...match,
        players: newPlayers,
        countdownRemaining: match.countdownRemaining || config.joinCountdown,
      }
    });
  },
  
  removePlayer: (playerId) => {
    const { match } = get();
    if (!match || match.status === 'finished') return;
    
    const newPlayers = match.players.filter(p => p.id !== playerId);
    const newPieces = [...get().availablePieces];
    const removedPlayer = match.players.find(p => p.id === playerId);
    if (removedPlayer?.piece) {
      newPieces.push(removedPlayer.piece);
    }
    
    set({
      match: {
        ...match,
        players: newPlayers,
        currentTurnIndex: newPlayers.length === 0 ? 0 : Math.min(match.currentTurnIndex, newPlayers.length - 1),
        status: newPlayers.length === 0 ? 'finished' : match.status,
        phase: newPlayers.length === 0 ? 'finished' : match.phase,
      },
      availablePieces: newPieces,
    });
  },
  
  setPlayerPiece: (playerId, piece) => {
    const { match, availablePieces } = get();
    if (!match) return;

    const newAvailablePieces = availablePieces.filter(p => p !== piece);
    const newPlayers = match.players.map(p =>
      p.id === playerId ? { ...p, piece } : p
    );

    set({
      match: { ...match, players: newPlayers },
      availablePieces: newAvailablePieces,
    });
  },

  updatePlayerBalance: (playerId, newBalance) => {
    const { match } = get();
    if (!match) return;

    const newPlayers = match.players.map(p =>
      p.id === playerId ? { ...p, balance: newBalance } : p
    );

    set({
      match: { ...match, players: newPlayers }
    });
  },

  updateGameBalance: (amount) => {
    const { match } = get();
    if (!match) return;

    set({
      match: { ...match, gameBalance: match.gameBalance + amount }
    });
  },

  addCoinsToGame: async (playerId, amount) => {
    // This will be implemented in the hook since it needs coin transaction logic
    return false;
  },
  
  startGame: () => {
    const { match } = get();
    if (!match) return;
    
    set({
      match: {
        ...match,
        status: 'active',
        phase: 'playing',
        currentTurnIndex: 0,
      },
      viewerStatus: 'playing',
    });
  },
  
  rollDice: () => {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    
    const { match } = get();
    if (!match) return total;
    
    set({
      match: { ...match, lastDiceRoll: total }
    });
    
    return total;
  },
  
  movePlayer: (playerId, spaces) => {
    const { match } = get();
    if (!match) return;
    
    const player = match.players.find(p => p.id === playerId);
    if (!player) return;
    
    let newPosition = player.position + spaces;
    if (newPosition >= match.properties.length) {
      newPosition = newPosition % match.properties.length;
    }
    
    const newPlayers = match.players.map(p =>
      p.id === playerId ? { ...p, position: newPosition } : p
    );
    
    set({
      match: { ...match, players: newPlayers }
    });
  },
  
  nextTurn: () => {
    const { match } = get();
    if (!match || match.status !== 'active') return;
    
    let nextIndex = match.currentTurnIndex + 1;
    if (nextIndex >= match.players.length) {
      nextIndex = 0;
    }
    
    set({
      match: { ...match, currentTurnIndex: nextIndex }
    });
  },
  
  buyProperty: (playerId, propertyId) => {
    const { match } = get();
    if (!match) return false;
    
    const player = match.players.find(p => p.id === playerId);
    const property = match.properties.find(p => p.id === propertyId);
    
    if (!player || !property || property.ownerId !== null) return false;
    if (player.balance < property.price) return false;
    
    const newPlayers = match.players.map(p =>
      p.id === playerId ? { ...p, balance: p.balance - property.price } : p
    );
    
    const newProperties = match.properties.map(p =>
      p.id === propertyId ? { ...p, ownerId: playerId } : p
    );
    
    set({
      match: { ...match, players: newPlayers, properties: newProperties }
    });
    
    return true;
  },
  
  payRent: (fromPlayerId, toPlayerId, amount) => {
    const { match } = get();
    if (!match) return false;
    
    const fromPlayer = match.players.find(p => p.id === fromPlayerId);
    const toPlayer = match.players.find(p => p.id === toPlayerId);
    
    if (!fromPlayer || !toPlayer) return false;
    if (fromPlayer.balance < amount) return false;
    
    const newPlayers = match.players.map(p => {
      if (p.id === fromPlayerId) return { ...p, balance: p.balance - amount };
      if (p.id === toPlayerId) return { ...p, balance: p.balance + amount };
      return p;
    });
    
    set({
      match: { ...match, players: newPlayers }
    });
    
    return true;
  },
  
  endGame: (winnerId) => {
    const { match } = get();
    if (!match) return;
    
    set({
      match: { 
        ...match, 
        status: 'finished', 
        phase: 'finished',
        winnerId 
      },
      viewerStatus: 'finished',
    });
  },
  
  resetMatch: () => {
    set({
      match: null,
      availablePieces: [...AVAILABLE_PIECES],
      viewerStatus: 'none',
    });
  },
}));
