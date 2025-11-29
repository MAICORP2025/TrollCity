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
    const { profile } = useAuthStore.getState();
    if (!user || !profile || !roomName.trim() || !streamTitle.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Generate a UUID for the stream ID (using crypto.randomUUID if available, otherwise fallback)
      const streamId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 11)}`;

      // 1️⃣ Save or update stream in Supabase
      const { data: streamRecord, error: dbError } = await supabase
        .from('streams')
        .insert({
          id: streamId,
          broadcaster_id: profile.id, // Use profile.id instead of user.id
          title: streamTitle,
          is_live: true,
          status: 'live',
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError || !streamRecord) {
        console.error('Stream creation error:', dbError);
        throw new Error(dbError?.message || 'Failed to create/update stream in Supabase');
      }

      // 2️⃣ Get LiveKit token using Edge function
      // Use streamId as room name for consistency (so it's available on page refresh)
      const tokenResp = await api.post('/livekit-token', {
        room: streamId, // Use streamId instead of roomName for consistency
        identity: user.email || user.id,
        isHost: true,
      });

      // Check if the request was successful
      if (!tokenResp?.success && tokenResp?.error) {
        console.error('LiveKit token error:', tokenResp);
        throw new Error(tokenResp.error);
      }

      // The API returns 'livekitUrl' but we need to check for it
      const serverUrl = tokenResp?.livekitUrl || tokenResp?.serverUrl;
      let token = tokenResp?.token;
      
      // Ensure token is a string, not an object
      if (token && typeof token !== 'string') {
        console.warn('Token is not a string, extracting:', token);
        token = typeof token === 'object' && token?.token 
          ? token.token 
          : String(token);
      }
      
      if (!token || !serverUrl) {
        console.error('LiveKit token response:', tokenResp);
        throw new Error(tokenResp?.error || 'LiveKit token missing token or serverUrl');
      }

      // Validate token is a proper JWT string
      if (typeof token !== 'string' || token.length < 10) {
        console.error('Invalid token format:', typeof token, token);
        throw new Error('Invalid token format received from server');
      }

      // 3️⃣ Navigate to StreamRoom with the streamId in the URL
      navigate(`/stream/${streamId}`, {
        state: {
          roomName: streamId, // Use streamId as roomName for consistency
          serverUrl: serverUrl,
          token: token, // Ensure it's a string
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
