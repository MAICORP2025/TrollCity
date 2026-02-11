import React from 'react';

const LivePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-4xl font-bold text-green-500 mb-4">Live Stream</h1>
        <p className="text-lg">The live stream will appear here.</p>
      </div>
    </div>
  );
};

export default LivePage;
