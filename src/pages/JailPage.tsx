import React from 'react';
import { useAuthStore } from '../lib/store';
import { useJailMode } from '../hooks/useJailMode';
import { formatDuration } from '../utils/time';

const JailPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { isJailed, jailTimeRemaining, releaseTime } = useJailMode(user?.id);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">You are in Jail</h1>
        {isJailed ? (
          <div>
            <p className="text-lg mb-2">You are currently serving a sentence.</p>
            <p className="text-lg font-semibold">Time Remaining:</p>
            <div className="text-5xl font-mono my-4 p-4 bg-gray-900 border-2 border-red-500 rounded-lg">
              {jailTimeRemaining ? formatDuration(jailTimeRemaining) : 'Calculating...'}
            </div>
            <p className="text-sm text-gray-400">Release Time: {releaseTime ? new Date(releaseTime).toLocaleString() : 'N/A'}</p>
          </div>
        ) : (
          <div>
            <p className="text-lg mb-2">You are not currently jailed.</p>
            <p className="text-green-500 font-semibold">You are free to go!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JailPage;
