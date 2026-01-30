// Overview tab
export function OverviewTab() {
  return <div className="max-w-2xl mx-auto"><h2 className="text-xl font-bold mb-4">Welcome to GameTrollz</h2><p>This is your hub for streaming, tournaments, clips, and more. Select a tab to get started!</p></div>;
}

// Tournaments tab
export function TournamentsTab() {
  return <div className="max-w-2xl mx-auto"><h2 className="text-xl font-bold mb-4">Tournaments</h2><p>Coming soon: Join and create tournaments, view brackets, and compete for prizes.</p></div>;
}

// Rules tab
export function RulesTab() {
  return <div className="max-w-2xl mx-auto"><h2 className="text-xl font-bold mb-4">Rules</h2><p>Review and accept the latest GameTrollz rules to participate in events and streams.</p></div>;
}

// Payouts tab
export function PayoutsTab() {
  return <div className="max-w-2xl mx-auto"><h2 className="text-xl font-bold mb-4">Payouts</h2><p>Track your tournament and stream earnings. Set up payout methods and view history here.</p></div>;
}
import React from 'react';
import { supabase } from '../lib/supabase';

// StreamTab implementation (moved from game.tsx)
export function StreamTab({ profile, user }) {
  const [broadcastSession, setBroadcastSession] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [showStart, setShowStart] = React.useState(false);
  const [form, setForm] = React.useState({ title: '', game_name: '', tags: '', visibility: 'public' });

  React.useEffect(() => {
    let mounted = true;
    async function loadSession() {
      setLoading(true);
      const { data } = await supabase
        .from('broadcast_sessions')
        .select('*')
        .eq('created_by', user.id)
        .eq('category', 'Gaming')
        .in('status', ['live', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setBroadcastSession(data);
      setLoading(false);
    }
    if (user?.id) loadSession();
    return () => { mounted = false; };
  }, [user?.id]);

  const hasPrimaryStream = profile?.primary_stream_provider && profile?.primary_stream_url;
  const embed = hasPrimaryStream ? getStreamEmbed(profile.primary_stream_provider, profile.primary_stream_url) : null;

  async function handleStartStream(e) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from('broadcast_sessions')
      .upsert({
        created_by: user.id,
        title: form.title,
        category: 'Gaming',
        game_name: form.game_name,
        tags: form.tags,
        visibility: form.visibility,
        status: 'live',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }, { onConflict: 'created_by,category' })
      .select()
      .maybeSingle();
    setLoading(false);
    if (!error) {
      setBroadcastSession(data);
      setShowStart(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Stream to Troll City</h2>
      {embed ? (
        <div className="mb-6">
          <div className="mb-2 text-sm text-gray-300">Your connected stream ({profile.primary_stream_provider})</div>
          {embed}
        </div>
      ) : null}
      <div className="mb-6">
        <div className="mb-2 text-sm text-gray-300">Or use Troll City native broadcast:</div>
        {broadcastSession && broadcastSession.status === 'live' ? (
          <div className="p-4 bg-green-900/30 border border-green-700 rounded-xl mb-2">Your game stream is <b>LIVE</b>.<br />Title: {broadcastSession.title}<br />Game: {broadcastSession.game_name}</div>
        ) : (
          <>
            {showStart ? (
              <form onSubmit={handleStartStream} className="space-y-3 bg-[#18122B] p-4 rounded-xl border border-purple-700">
                <div>
                  <label className="block text-sm mb-1">Title</label>
                  <input required className="w-full rounded bg-[#232042] p-2 text-white" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Game Name</label>
                  <input required className="w-full rounded bg-[#232042] p-2 text-white" value={form.game_name} onChange={e => setForm(f => ({ ...f, game_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Tags (comma separated)</label>
                  <input className="w-full rounded bg-[#232042] p-2 text-white" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Visibility</label>
                  <select className="w-full rounded bg-[#232042] p-2 text-white" value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}>
                    <option value="public">Public</option>
                    <option value="followers">Followers</option>
                  </select>
                </div>
                <button type="submit" className="w-full mt-2 py-2 rounded bg-gradient-to-r from-purple-700 to-pink-700 text-white font-bold shadow-troll-glow" disabled={loading}>{loading ? 'Starting...' : 'Start Game Stream'}</button>
                <button type="button" className="w-full mt-2 py-2 rounded bg-[#232042] text-gray-300 border border-purple-700" onClick={() => setShowStart(false)}>Cancel</button>
              </form>
            ) : (
              <button className="w-full py-3 rounded bg-gradient-to-r from-purple-700 to-pink-700 text-white font-bold shadow-troll-glow" onClick={() => setShowStart(true)}>Start Game Stream</button>
            )}
          </>
        )}
      </div>
      {!embed && (!broadcastSession || broadcastSession.status !== 'live') && (
        <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-xl text-yellow-200">Connect your stream link in Settings or start a native Troll City game stream above.</div>
      )}
    </div>
  );
}

function getStreamEmbed(provider, url) {
  if (!provider || !url) return null;
  if (provider === 'twitch') {
    const match = url.match(/twitch.tv\/(\w+)/i);
    const channel = match ? match[1] : null;
    if (!channel) return null;
    return (
      <iframe
        src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`}
        height="400"
        width="700"
        allowFullScreen
        frameBorder="0"
        className="rounded-xl border border-purple-700 shadow-troll-glow"
        title="Twitch Stream"
      />
    );
  }
  if (provider === 'youtube') {
    const match = url.match(/(?:youtube.com\/.*v=|youtu.be\/)([\w-]+)/i);
    const videoId = match ? match[1] : null;
    if (!videoId) return null;
    return (
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        height="400"
        width="700"
        allowFullScreen
        frameBorder="0"
        className="rounded-xl border border-red-700 shadow-troll-glow"
        title="YouTube Stream"
      />
    );
  }
  if (provider === 'kick') {
    const match = url.match(/kick.com\/(\w+)/i);
    const channel = match ? match[1] : null;
    if (!channel) return null;
    return (
      <iframe
        src={`https://player.kick.com/${channel}`}
        height="400"
        width="700"
        allowFullScreen
        frameBorder="0"
        className="rounded-xl border border-green-700 shadow-troll-glow"
        title="Kick Stream"
      />
    );
  }
  return null;
}

// Placeholder for LinksTab, SettingsTab, ClipsTab
export function LinksTab({ profile: _profile }) {
  return <div>LinksTab implementation here</div>;
}
export function SettingsTab({ profile: _profile, user: _user }) {
  return <div>SettingsTab implementation here</div>;
}
export function ClipsTab({ user: _user }) {
  return <div>ClipsTab implementation here</div>;
}
