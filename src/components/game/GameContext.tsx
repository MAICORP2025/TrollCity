import React, { createContext, useState, useCallback, ReactNode } from 'react';
import DrivingAnimation from './DrivingAnimation';

export interface GameContextType {
  isDriving: boolean;
  destination: string | null;
  startDriving: (to: string, onArrive?: () => void) => void;
  isRaidActive: boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [isDriving, setIsDriving] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [isRaidActive, setIsRaidActive] = useState(false);
  const [arrivalCallback, setArrivalCallback] = useState<(() => void) | null>(null);

  const startDriving = useCallback((to: string, onArrive?: () => void) => {
    setDestination(to);
    setIsDriving(true);
    setArrivalCallback(() => onArrive || null);
    
    // Random chance for road raid (10%)
    const triggerRaid = Math.random() < 0.1;
    setIsRaidActive(triggerRaid);
  }, []);

  const handleArrival = useCallback(() => {
    setIsDriving(false);
    setDestination(null);
    setIsRaidActive(false);
    if (arrivalCallback) {
      arrivalCallback();
      setArrivalCallback(null);
    }
  }, [arrivalCallback]);

  return (
    <GameContext.Provider value={{ isDriving, destination, startDriving, isRaidActive }}>
      {children}
      {isDriving && destination && (
        <DrivingAnimation 
          destination={destination} 
          onComplete={handleArrival} 
          isRaid={isRaidActive}
        />
      )}
    </GameContext.Provider>
  );
}

export default GameContext;
