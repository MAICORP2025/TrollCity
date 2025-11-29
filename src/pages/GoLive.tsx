import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

interface GoLiveProps {
  className?: string;
}

const GoLive: React.FC<GoLiveProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto cleanup if host closes tab
  useEffect(() => {
    return () => {
      if (roomName) {
        supabase
          .from('streams')
          .update({ is_live: false, end_time: new Date().toISOString() })
          .eq('id', roomName);
      }
    };
  }, [roomName]);

  const handleStartStream = async () => {
    if (!user || !roomName.trim() || !streamTitle.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // 1️⃣ Save or update stream in Supabase
      const { data: streamRecord, error: dbError } = await supabase
        .from('streams')
        .upsert(
          {
            id: roomName, // roomName is used as ID
            user_id: user.id,
            title: streamTitle,
            livekit_room: roomName,
            is_live: true,
            start_time: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (dbError || !streamRecord) {
        throw new Error('Failed to create/update stream in Supabase');
      }

      // 2️⃣ Get LiveKit token using Edge function
      const tokenResp = await api.post('/livekit-token', {
        room: roomName,
        identity: user.email || user.id,
        isHost: true,
      });

      if (!tokenResp?.token || !tokenResp?.serverUrl) {
        throw new Error('LiveKit token missing token or serverUrl');
      }

      // 3️⃣ Navigate to StreamRoom — no Room object passed
      navigate('/stream-room', {
        state: {
          roomName,
          serverUrl: tokenResp.serverUrl,
          token: tokenResp.token,
          streamTitle,
          isHost: true,
        },
      });

    } catch (err: any) {
      console.error('Stream start error:', err);
      setError(err.message || 'Failed to start stream');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${className}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-center">Go Live</h1>
          
          <div className="bg-gray-800 rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Stream Title *</label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter your stream title..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isConnecting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Room Name *</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isConnecting}
              />
            </div>

            {error && (
              <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleStartStream}
              disabled={isConnecting || !roomName.trim() || !streamTitle.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 px-4 rounded-md font-medium transition-colors"
            >
              {isConnecting ? 'Starting Stream...' : 'Go Live'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoLive;
