import React, { useEffect, useState } from 'react';
import { Rarity } from '../useTrollEngine';

interface FakeCoinLossProps {
  rarity: Rarity;
}

const FakeCoinLoss: React.FC<FakeCoinLossProps> = ({ rarity }) => {
  const [coinCount, setCoinCount] = useState<number>(1000); // Fake initial coin count
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [showRecovery, setShowRecovery] = useState<boolean>(false);

  useEffect(() => {
    // Start animation after a short delay
    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, 100);

    // Simulate coin loss
    const lossInterval = setInterval(() => {
      setCoinCount(prev => {
        const loss = Math.floor(Math.random() * 100) + 50;
        const newCount = Math.max(0, prev - loss);
        
        if (newCount === 0) {
          clearInterval(lossInterval);
          // Show recovery after a delay
          setTimeout(() => {
            setShowRecovery(true);
          }, 1000);
        }

        return newCount;
      });
    }, 200);

    return () => {
      clearTimeout(timer);
      clearInterval(lossInterval);
    };
  }, []);

  // Recover coins
  useEffect(() => {
    if (showRecovery) {
      const recoveryInterval = setInterval(() => {
        setCoinCount(prev => {
          const recovery = Math.floor(Math.random() * 100) + 50;
          const newCount = prev + recovery;
          
          if (newCount >= 1000) {
            clearInterval(recoveryInterval);
            return 1000;
          }

          return newCount;
        });
      }, 200);

      return () => clearInterval(recoveryInterval);
    }
  }, [showRecovery]);

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[1001] flex items-center justify-center">
      <div 
        className={`max-w-md w-full bg-gray-900 rounded-lg border-2 p-8 text-center transition-all duration-500 ${
          isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        } ${
          rarity === 'COMMON' ? 'border-yellow-500' :
          rarity === 'RARE' ? 'border-orange-500' :
          rarity === 'EPIC' ? 'border-red-500' : 'border-purple-500'
        }`}
      >
        {/* Header */}
        <div className="mb-6">
          <div className={`w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center mx-auto mb-4 ${
            coinCount > 0 ? 'animate-bounce' : 'animate-pulse'
          }`}>
            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className={`text-xl font-bold mb-2 ${
            rarity === 'COMMON' ? 'text-yellow-400' :
            rarity === 'RARE' ? 'text-orange-400' :
            rarity === 'EPIC' ? 'text-red-400' : 'text-purple-400'
          }`}>
            COIN SYSTEM ERROR
          </h1>
          <p className="text-gray-400 text-sm">Your coins are being deducted...</p>
        </div>

        {/* Coin count */}
        <div className="mb-6">
          <div className={`text-4xl font-bold mb-2 ${
            coinCount > 0 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {coinCount}
          </div>
          <p className="text-gray-400 text-sm">TROLL COINS</p>
        </div>

        {/* Status message */}
        <div className="bg-gray-800 rounded p-4 mb-6 text-left">
          <p className="text-sm mb-2 text-gray-400">
            {coinCount > 0 ? 'Coins are disappearing rapidly!' : 'All coins have been lost!'}
          </p>
          {showRecovery && (
            <p className="text-sm text-green-400">
              Coins are being restored...
            </p>
          )}
        </div>

        {/* Action button */}
        <div className="flex justify-center">
          {showRecovery ? (
            <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors">
              Coins Restored
            </button>
          ) : (
            <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors">
              {coinCount > 0 ? 'Stop Deduction' : 'Recover Coins'}
            </button>
          )}
        </div>

        {/* Legendary effect */}
        {rarity === 'LEGENDARY' && (
          <div className="mt-8">
            <p className="text-purple-400 text-sm mb-2">SYSTEM ANALYSIS</p>
            <div className="bg-purple-900 bg-opacity-20 rounded p-4">
              <p className="text-purple-300 text-sm">
                This was just a troll! Your coins are safe and secure. We just wanted to see your reaction!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FakeCoinLoss;
