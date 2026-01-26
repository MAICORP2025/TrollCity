
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Save, BookOpen, Mic, Gift, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import PastorPayouts from './PastorPayouts';

export default function PastorDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'sermon' | 'payouts'>('sermon');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && !profile.is_pastor && profile.role !== 'admin' && !(profile as any).is_admin) {
       navigate('/church');
       toast.error('Unauthorized access');
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchNotes();
  }, [date]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('church_sermon_notes')
        .select('notes')
        .eq('pastor_id', profile?.id)
        .eq('date', date)
        .maybeSingle();
      
      setNotes(data?.notes || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('church_sermon_notes')
        .upsert({
           pastor_id: profile?.id,
           date: date,
           notes: notes,
           updated_at: new Date().toISOString()
        }, { onConflict: 'pastor_id, date' });

      if (error) throw error;
      toast.success('Sermon notes saved');
    } catch (err) {
      toast.error('Failed to save notes');
      console.error(err);
    }
  };

  const handleBroadcast = async () => {
     // Trigger a global announcement for church
     try {
       await supabase.from('admin_broadcasts').insert({
          message: "Troll Church is now LIVE! Join us for the Sunday Service.",
          type: 'info', // or 'church' if supported
          is_active: true,
          created_by: profile?.id
       });
       toast.success('Broadcast sent!');
     } catch (err) {
       toast.error('Failed to send broadcast');
     }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
       <div className="max-w-4xl mx-auto">
          <header className="mb-8 border-b border-white/10 pb-4 flex justify-between items-end">
             <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <BookOpen className="text-purple-400" />
                    Pastor Dashboard
                </h1>
                <p className="text-gray-400 mt-2">Prepare your sermon and manage the service.</p>
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={() => setActiveTab('sermon')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'sermon' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-gray-400 hover:text-white'}`}
                >
                    Sermon & Live
                </button>
                <button 
                  onClick={() => setActiveTab('payouts')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'payouts' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-gray-400 hover:text-white'}`}
                >
                    Earnings & Payouts
                </button>
             </div>
          </header>

          {activeTab === 'payouts' ? (
            <PastorPayouts />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Editor */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                   <div className="flex justify-between items-center mb-4">
                      <h2 className="font-bold flex items-center gap-2">
                         <Save size={18} className="text-blue-400" />
                         Sermon Notes
                      </h2>
                      <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)}
                        className="bg-black border border-zinc-700 rounded px-2 py-1 text-sm"
                      />
                   </div>
                   
                   <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full h-96 bg-black/40 border border-zinc-700 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-purple-500 font-mono"
                      placeholder="Write your sermon notes here..."
                   />
                   
                   <div className="mt-4 flex justify-end">
                      <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center gap-2"
                      >
                         <Save size={18} />
                         Save Notes
                      </button>
                   </div>
                </div>
             </div>

             {/* Sidebar Tools */}
             <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                   <h2 className="font-bold mb-4 flex items-center gap-2">
                      <Mic size={18} className="text-red-400" />
                      Live Controls
                   </h2>
                   
                   <button 
                     onClick={handleBroadcast}
                     className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold mb-3 flex items-center justify-center gap-2"
                   >
                      <Mic size={18} />
                      Send "Live" Alert
                   </button>
                   <p className="text-xs text-gray-500 text-center">
                      Sends a global notification that Church is live.
                   </p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
                   <h2 className="font-bold mb-4 flex items-center gap-2">
                      <Gift size={18} className="text-amber-400" />
                      Sunday Gifts
                   </h2>
                   <div className="text-center py-4 bg-black/20 rounded-lg border border-white/5">
                      <p className="text-2xl font-bold text-amber-400">0</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Coins Received</p>
                   </div>
                </div>
             </div>
          </div>
          )}
       </div>
    </div>
  );
}
