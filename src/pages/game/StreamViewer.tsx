import React from 'react';
import { useParams } from 'react-router-dom';

// Fake viewer page for a live stream
export default function StreamViewer() {
  const { streamId } = useParams();
  // In real app, fetch stream info by streamId
  return (
    <div className="max-w-3xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Now Watching: Stream {streamId}</h2>
      <div className="aspect-video bg-black rounded-xl mb-4 flex items-center justify-center text-white text-3xl">
        [Live Stream Video Here]
      </div>
      <div className="bg-[#18122B] rounded-xl p-4 mb-4">
        <div className="font-semibold mb-2">Chat</div>
        <div className="h-40 bg-[#232042] rounded mb-2 p-2 text-gray-300">[Chat messages]</div>
        <input className="w-full rounded bg-[#232042] p-2 text-white" placeholder="Type your message..." />
      </div>
      <div className="text-xs text-gray-400">You are viewing as a guest. <a href="/login" className="text-blue-400 underline">Sign in</a> to chat and send gifts.</div>
    </div>
  );
}
