
import React, { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DailyChurchNotification() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    
    // Check if notifications enabled (default true if undefined)
    const enabled = profile.church_notifications_enabled !== false;
    if (!enabled) return;

    const checkNotification = () => {
        const today = new Date().toISOString().split('T')[0];
        const lastSeen = localStorage.getItem('last_church_notification');
        
        // Only show if not seen today AND it's between 8 AM and 8 PM (optional, but good UX)
        // Prompt says "Active Hours 1PM - 3PM". 
        // "Today's passage is ready, come pray at Troll Church!"
        // Maybe show it when app opens if it's open? Or just anytime today.
        
        if (lastSeen !== today) {
            // Check if church is open? Or just notify passage is ready.
            // Prompt: "Today’s passage is ready..."
            
            toast.custom((id) => (
                <div className="flex items-start gap-3 w-full">
                    <div className="bg-purple-900/50 p-2 rounded-full">
                        <BookOpen size={18} className="text-purple-300" />
                    </div>
                    <div>
                        <p className="font-bold text-sm text-white">Daily Word Ready</p>
                        <p className="text-xs text-gray-300 mb-2">Come pray at Troll Church!</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    toast.dismiss(id);
                                    navigate('/church');
                                }}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded"
                            >
                                Go to Church
                            </button>
                            <button 
                                onClick={() => toast.dismiss(id)}
                                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            ), { 
                duration: 8000, 
                position: 'top-right',
                style: {
                    background: '#1e1b4b', // indigo-950
                    border: '1px solid #4c1d95', // purple-900
                    padding: '12px',
                    color: 'white'
                }
            });
            
            localStorage.setItem('last_church_notification', today);
        }
    };

    // Small delay to not conflict with other startup toasts
    const timer = setTimeout(checkNotification, 3000);
    return () => clearTimeout(timer);

  }, [profile, navigate]);

  return null;
}
