import React, { useEffect, useState } from 'react';
import { Rarity } from '../useTrollEngine';

interface FakeVirusScanProps {
  rarity: Rarity;
}

const FakeVirusScan: React.FC<FakeVirusScanProps> = ({ rarity }) => {
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [showAlert, setShowAlert] = useState<boolean>(false);

  useEffect(() => {
    // Start animation after a short delay
    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, 100);

    // Simulate scan progress
    const scanInterval = setInterval(() => {
      setScanProgress(prev => {
        const increment = Math.random() * 10;
        const newProgress = Math.min(prev + increment, 100);
        
        if (newProgress >= 100) {
          clearInterval(scanInterval);
          setIsScanning(false);
          // Show alert after scan completes
          setTimeout(() => {
            setShowAlert(true);
          }, 500);
        }

        return newProgress;
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      clearInterval(scanInterval);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[1001] flex items-center justify-center">
      <div 
        className={`max-w-md w-full bg-gray-900 rounded-lg border-2 p-8 text-center transition-all duration-500 ${
          isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        } ${
          rarity === 'COMMON' ? 'border-green-500' :
          rarity === 'RARE' ? 'border-blue-500' :
          rarity === 'EPIC' ? 'border-purple-500' : 'border-yellow-500'
        }`}
      >
        {/* Scan header */}
        <div className="mb-6">
          <div className={`w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4 ${
            isScanning ? 'animate-spin' : 'animate-pulse'
          }`}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className={`text-xl font-bold mb-2 ${
            rarity === 'COMMON' ? 'text-green-400' :
            rarity === 'RARE' ? 'text-blue-400' :
            rarity === 'EPIC' ? 'text-purple-400' : 'text-yellow-400'
          }`}>
            TROLL VIRUS SCAN
          </h1>
          <p className="text-gray-400 text-sm">Scanning for malicious troll code...</p>
        </div>

        {/* Scan progress bar */}
        <div className="mb-6">
          <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                rarity === 'COMMON' ? 'bg-green-500' :
                rarity === 'RARE' ? 'bg-blue-500' :
                rarity === 'EPIC' ? 'bg-purple-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <p className="text-gray-400 text-sm mt-2">{Math.round(scanProgress)}% complete</p>
        </div>

        {/* Scan log */}
        <div className="bg-gray-800 rounded p-4 mb-6 text-left h-32 overflow-y-auto">
          <div className="text-xs text-gray-400 mb-1">
            {isScanning ? 'Scanning system files...' : 'Scan complete'}
          </div>
          {scanProgress > 25 && (
            <div className="text-xs text-yellow-400 mb-1">
              Warning: Suspicious activity detected!
            </div>
          )}
          {scanProgress > 50 && (
            <div className="text-xs text-orange-400 mb-1">
              Virus signature match found!
            </div>
          )}
          {scanProgress > 75 && (
            <div className="text-xs text-red-400 mb-1">
              CRITICAL: Trojan.Troll detected!
            </div>
          )}
          {showAlert && (
            <div className="text-xs text-green-400 mb-1">
              Cleanup complete! Your computer has been trolled.
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex justify-center">
          {isScanning ? (
            <button className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors cursor-not-allowed" disabled>
              Scanning...
            </button>
          ) : (
            <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors">
              Close Scanner
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FakeVirusScan;
