import React from 'react';
import { useParams } from 'react-router-dom';

// Fake streamer control page for a live stream
export default function StreamerControl() {
  const { streamId } = useParams();
  // In real app, fetch stream info by streamId and check ownership
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Your Live Stream: {streamId}</h2>
      <div className="aspect-video bg-black rounded-xl mb-4 flex items-center justify-center text-white text-3xl">
        [Your Live Stream Video]
      </div>
      <div className="bg-[#18122B] rounded-xl p-4 mb-4">
        <div className="font-semibold mb-2">Chat (with viewers)</div>
        <div className="h-40 bg-[#232042] rounded mb-2 p-2 text-gray-300">[Chat messages]</div>
        <input className="w-full rounded bg-[#232042] p-2 text-white" placeholder="Type your message..." />
      </div>
      <div className="flex gap-2 mt-4">
        <button className="px-4 py-2 rounded bg-red-700 text-white font-bold">End Stream</button>
        <button className="px-4 py-2 rounded bg-blue-700 text-white font-bold">View as Viewer</button>
      </div>
      <div className="text-xs text-gray-400 mt-4">You are in streamer control mode. Viewers will not see your stream settings.</div>
    </div>
  );
}
