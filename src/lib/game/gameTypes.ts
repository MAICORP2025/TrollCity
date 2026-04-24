// Central game types to avoid circular dependencies

export type GameType =
  | 'two-truths-lie'
  | 'fame-shame-wheel'
  | 'troll-identity-hunt'
  | 'reaction-speed'
  | 'multiplayer-solitaire'
  | 'multiplayer-dominoes'
  | 'snake'
  | 'pong'
  | 'tetris'
  | 'trollopoly';

export type PageTab = 'games' | 'giveaways';

// Trollopoly piece types
export type TrollopolyPiece = 'car' | 'yacht' | 'jet' | 'stick_figure' | 'tree' | 'troll_character';

// Trollopoly game state
export interface TrollopolyPlayer {
  id: string;
  username: string;
  avatar?: string;
  piece: TrollopolyPiece | null;
  balance: number;
  position: number;
  isBankrupt: boolean;
  isConnected: boolean;
}

export interface TrollopolyProperty {
  id: number;
  name: string;
  type: 'city' | 'utility' | 'transport' | 'event';
  price: number;
  rent: number;
  ownerId: string | null;
  buildingLevel: number;
  group: string;
}

export type TrollopolyPhase = 'lobby' | 'piece_selection' | 'playing' | 'finished';

export interface TrollopolyState {
  matchId: string;
  gameType: 'trollopoly';
  status: 'waiting' | 'active' | 'finished';
  phase: TrollopolyPhase;
  players: TrollopolyPlayer[];
  currentTurnPlayerId: string | null;
  countdownRemaining: number;
  lobbyOpen: boolean;
  boardRotation: number;
  lastDiceRoll: number | null;
  properties: TrollopolyProperty[];
}
