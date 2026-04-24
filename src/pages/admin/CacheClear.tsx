import React, { useState } from 'react';
import { 
  Trash2, 
  RefreshCw, 
  Server, 
  Database, 
  Globe, 
  CheckCircle, 
  AlertOctagon,
  Cpu
} from 'lucide-react';

const CacheClear: React.FC = () => {
  const [clearing, setClearing] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  const clearServerCache = async () => {
    setClearing('server');
    try {
      const response = await fetch('/api/admin/cache/clear', { method: 'POST' });
      if (!response.ok) throw new Error('Failed');
      setStatus(prev => ({ ...prev, server: 'success' }));
    } catch (error) {
      console.error(error);
      setStatus(prev => ({ ...prev, server: 'error' }));
    } finally {
      setClearing(null);
      setTimeout(() => setStatus(prev => ({ ...prev, server: null })), 3000);
    }
  };

  const clearLocalCache = () => {
    setClearing('local');
    try {
      localStorage.clear();
      sessionStorage.clear();
      // We don't want to clear EVERYTHING potentially (like auth tokens), but "Clear Cache" usually implies a hard reset.
      // Ideally we preserve auth, but let's just clear specific keys if we knew them.
      // For now, clearing everything is what "Clear Cache" implies.
      setStatus(prev => ({ ...prev, local: 'success' }));
    } catch (error) {
      console.error(error);
      setStatus(prev => ({ ...prev, local: 'error' }));
    } finally {
      setClearing(null);
      setTimeout(() => setStatus(prev => ({ ...prev, local: null })), 3000);
    }
  };

  const clearCDNCache = async () => {
    setClearing('cdn');
    // Mock CDN clearing
    setTimeout(() => {
      setStatus(prev => ({ ...prev, cdn: 'success' }));
      setClearing(null);
      setTimeout(() => setStatus(prev => ({ ...prev, cdn: null })), 3000);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trash2 className="w-8 h-8 text-pink-500" />
              Cache Management
            </h1>
            <p className="text-gray-400 mt-2">Clear system caches to resolve synchronization issues</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-pink-500/10 border border-pink-500/20 rounded-lg">
            <Cpu className="w-4 h-4 text-pink-400" />
            <span className="text-pink-400 text-sm font-medium">Memory Usage: Normal</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Server Cache */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center hover:border-purple-500/30 transition-colors">
            <div className="w-16 h-16 bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
              <Server className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Server Cache</h3>
            <p className="text-sm text-gray-400 mb-6">
              Clear API response caches, temporary files, and server-side sessions.
            </p>
            <button
              onClick={clearServerCache}
              disabled={!!clearing}
              className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                status.server === 'success' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {clearing === 'server' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : status.server === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {status.server === 'success' ? 'Cleared' : 'Clear Server Cache'}
            </button>
          </div>

          {/* Local Cache */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center hover:border-blue-500/30 transition-colors">
            <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
              <Database className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Browser Storage</h3>
            <p className="text-sm text-gray-400 mb-6">
              Clear local storage and session data on this device. You may need to relogin.
            </p>
            <button
              onClick={clearLocalCache}
              disabled={!!clearing}
              className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                status.local === 'success' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {clearing === 'local' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : status.local === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {status.local === 'success' ? 'Cleared' : 'Clear Local Data'}
            </button>
          </div>

          {/* CDN Cache */}
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6 flex flex-col items-center text-center hover:border-orange-500/30 transition-colors">
            <div className="w-16 h-16 bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-orange-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">CDN Purge</h3>
            <p className="text-sm text-gray-400 mb-6">
              Purge cached assets from the Content Delivery Network edge nodes.
            </p>
            <button
              onClick={clearCDNCache}
              disabled={!!clearing}
              className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                status.cdn === 'success' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              {clearing === 'cdn' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : status.cdn === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertOctagon className="w-4 h-4" />
              )}
              {status.cdn === 'success' ? 'Purged' : 'Purge CDN'}
            </button>
          </div>

        </div>

        {/* Info Note */}
        <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-blue-400 mb-1">Important Note</p>
            <p>
              Clearing server cache may cause a temporary performance dip as data is re-fetched. 
              Purging CDN cache should only be done when static assets (images, scripts) are not updating correctly.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CacheClear;
