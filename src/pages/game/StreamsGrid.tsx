import React from 'react';
import { useNavigate } from 'react-router-dom';

// Fake data for demo
const liveStreams = [
  { id: '1', title: 'DarkKnight', game: 'Fortnite', img: 'https://placehold.co/320x180/18122B/fff?text=DarkKnight', viewers: 1200 },
  { id: '2', title: 'ElitePlayer', game: 'Warzone', img: 'https://placehold.co/320x180/18122B/fff?text=ElitePlayer', viewers: 980 },
  { id: '3', title: 'PixelPrincess', game: 'Minecraft', img: 'https://placehold.co/320x180/18122B/fff?text=PixelPrincess', viewers: 700 },
  { id: '4', title: 'SpeedFreak', game: 'Valorant', img: 'https://placehold.co/320x180/18122B/fff?text=SpeedFreak', viewers: 650 },
];
const featuredGames = [
  { name: 'FORTNITE', img: 'https://placehold.co/120x120/232042/fff?text=Fortnite' },
  { name: 'WARZONE', img: 'https://placehold.co/120x120/232042/fff?text=Warzone' },
  { name: 'VALORANT', img: 'https://placehold.co/120x120/232042/fff?text=Valorant' },
  { name: 'MINECRAFT', img: 'https://placehold.co/120x120/232042/fff?text=Minecraft' },
];
const tournaments = [
  { name: 'FORTNITE', prize: '6,000', start: 'in 2 hours', img: 'https://placehold.co/80x80/232042/fff?text=Fortnite' },
  { name: 'VALORANT', prize: '2,200', start: 'in 3 hours', img: 'https://placehold.co/80x80/232042/fff?text=Valorant' },
];
const challenges = [
  { name: 'Fortnite', reward: '300', desc: 'Win 10 BR matches', img: 'https://placehold.co/60x60/232042/fff?text=Fortnite' },
  { name: 'Call of Duty: Warzone', reward: '600', desc: 'Get 50 eliminations', img: 'https://placehold.co/60x60/232042/fff?text=Warzone' },
];

export default function StreamsGrid() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2D1B5A] to-[#18122B] text-white pb-10">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto pt-12 pb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">Welcome to GameTrollz</h1>
        <div className="text-lg text-purple-200 mb-6">Play, Stream, Compete & Earn in Troll City's Gaming Hub</div>
        <div className="mb-6 text-purple-300">Join thousands of creators and viewers in Troll City – where live streaming meets gaming, shopping, and connection.</div>
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <button className="bg-pink-600 hover:bg-pink-700 px-6 py-2 rounded font-bold text-white shadow-troll-glow">Start Streaming</button>
          <button className="bg-yellow-500 hover:bg-yellow-600 px-6 py-2 rounded font-bold text-white">Join a Tournament</button>
          <button className="bg-blue-700 hover:bg-blue-800 px-6 py-2 rounded font-bold text-white">Browse Games</button>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-purple-400">
          <span className="bg-[#232042] rounded px-2 py-1">Skill-Based Competition</span>
          <span className="bg-[#232042] rounded px-2 py-1">Earn Troll Coins</span>
          <span className="bg-[#232042] rounded px-2 py-1">Live Gaming Streams</span>
        </div>
      </div>

      {/* Live Gaming Now */}
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-xl font-bold mb-4">Live Gaming Now <span className="text-pink-400">•</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {liveStreams.map((s) => (
            <div key={s.id} className="bg-[#18122B] rounded-xl p-2 shadow-troll-glow cursor-pointer hover:bg-[#232042] transition flex flex-col" onClick={() => navigate(`/gametrollz/stream/${s.id}`)}>
              <img src={s.img} alt={s.title} className="rounded-lg mb-2 aspect-video object-cover" />
              <div className="font-bold text-base mb-1">{s.title}</div>
              <div className="text-xs text-gray-400 mb-1">{s.game}</div>
              <div className="text-xs text-green-400">{s.viewers} watching</div>
              <button className="mt-2 bg-pink-600 hover:bg-pink-700 px-3 py-1 rounded text-xs font-bold">Watch Stream</button>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Games */}
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-xl font-bold mb-4">Featured Games</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {featuredGames.map((g) => (
            <div key={g.name} className="bg-[#18122B] rounded-xl p-4 flex flex-col items-center">
              <img src={g.img} alt={g.name} className="rounded-full mb-2 w-20 h-20 object-cover" />
              <div className="font-bold text-base mb-1">{g.name}</div>
              <button className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-xs font-bold mt-2">View Game</button>
            </div>
          ))}
        </div>
      </div>

      {/* Active Tournaments */}
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-xl font-bold mb-4">Active Tournaments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {tournaments.map((t) => (
            <div key={t.name} className="bg-[#18122B] rounded-xl p-4 flex items-center gap-4">
              <img src={t.img} alt={t.name} className="rounded w-16 h-16 object-cover" />
              <div>
                <div className="font-bold text-base mb-1">{t.name}</div>
                <div className="text-xs text-yellow-400 mb-1">🏆 {t.prize} Troll Coins</div>
                <div className="text-xs text-gray-400">Starts {t.start}</div>
                <button className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded text-xs font-bold mt-2">View Bracket</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Game Challenges */}
      <div className="max-w-5xl mx-auto mb-10">
        <h2 className="text-xl font-bold mb-4">Game Challenges</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {challenges.map((c) => (
            <div key={c.name} className="bg-[#18122B] rounded-xl p-4 flex items-center gap-4">
              <img src={c.img} alt={c.name} className="rounded w-12 h-12 object-cover" />
              <div>
                <div className="font-bold text-base mb-1">{c.name}</div>
                <div className="text-xs text-purple-300 mb-1">{c.desc}</div>
                <div className="text-xs text-yellow-400">Reward: {c.reward} Troll Coins</div>
                <button className="bg-purple-700 hover:bg-purple-800 px-3 py-1 rounded text-xs font-bold mt-2">Join Challenge</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
