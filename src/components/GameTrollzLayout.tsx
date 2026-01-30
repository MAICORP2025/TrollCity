import React from 'react';
import { useAuthStore } from '../lib/store';

const GAMETROLLZ_MENU = [
  { key: 'overview', label: 'Overview' },
  { key: 'stream', label: 'Stream' },
  { key: 'clips', label: 'Clips' },
  { key: 'links', label: 'Links' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'rules', label: 'Rules' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'settings', label: 'Settings' },
];

export default function GameTrollzLayout({ children, activeTab, setActiveTab }) {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex">
      {/* Sidebar */}
      <aside className="w-80 min-w-[18rem] max-w-xs bg-[#18122B] border-r border-[#2C2C2C] flex flex-col py-6 px-4 gap-6 shadow-xl z-10">
        {/* Profile Card */}
        <div className="flex flex-col items-center gap-2 bg-[#1F1833] rounded-2xl p-4 mb-2 shadow-troll-glow">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-700 to-pink-600 border-4 border-[#2C2C2C] mb-2 overflow-hidden">
            <img
              src={profile?.avatar_url || '/assets/avatar-default.png'}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="font-bold text-lg tracking-wide">{profile?.username || 'Gamer'}</div>
          <div className="text-xs text-gray-400">@{user?.user_metadata?.username || user?.email?.split('@')[0]}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-yellow-400 font-bold">{profile?.troll_coins ?? 0}</span>
            <span className="text-xs text-gray-300">Troll Coins</span>
          </div>
          <button onClick={() => setActiveTab && setActiveTab('settings')} className="mt-2 text-xs text-blue-400 hover:underline">Edit</button>
        </div>
        {/* Sidebar Menu */}
        <nav className="flex flex-col gap-1">
          {GAMETROLLZ_MENU.map((item) => (
            <button
              key={item.key}
              className={`w-full text-left px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === item.key ? 'bg-gradient-to-r from-purple-700 to-pink-700 text-white shadow-troll-glow' : 'bg-[#18122B] text-gray-300 hover:bg-[#232042]'}`}
              onClick={() => setActiveTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-[#18122B] border-b border-[#2C2C2C] flex items-center justify-between px-8 py-4 shadow-troll-glow">
          <h1 className="text-2xl font-extrabold tracking-wide gradient-text-green-pink">GameTrollz</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab && setActiveTab('settings')} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-700 to-pink-700 text-white font-semibold shadow-troll-glow">Edit Gamer Profile</button>
          </div>
        </header>
        <section className="flex-1 p-8">
          {children}
        </section>
      </main>
    </div>
  );
}
