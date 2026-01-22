import React, { createContext, useCallback, ReactNode } from 'react';

export interface GameContextType {
  isDriving: boolean;
  destination: string | null;
  startDriving: (to: string, onArrive?: () => void) => void;
  isRaidActive: boolean;
  handleArrival: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const startDriving = useCallback((to: string, onArrive?: () => void) => {
    onArrive?.();
  }, []);

  const handleArrival = useCallback(() => {
    /* no-op: driving disabled */
  }, []);

  return (
    <GameContext.Provider
      value={{
        isDriving: false,
        destination: null,
        startDriving,
        isRaidActive: false,
        handleArrival,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export default GameContext;
