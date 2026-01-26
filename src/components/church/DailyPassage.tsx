
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Loader2, Calendar } from 'lucide-react';

interface Passage {
  reference: string;
  text: string;
  date: string;
}

export default function DailyPassage() {
  const [passage, setPassage] = useState<Passage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDailyPassage();
  }, []);

  const fetchDailyPassage = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Check DB cache
      const { data, error } = await supabase
        .from('church_passages')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (data) {
        setPassage(data);
        setLoading(false);
        return;
      }

      // 2. Fetch from API if not in DB
      const res = await fetch('https://bible-api.com/?random=verse');
      const json = await res.json();
      
      const newPassage = {
        date: today,
        reference: json.reference,
        text: json.text,
      };

      // 3. Cache in DB
      // We use upsert to handle race conditions (if multiple users hit it at once)
      const { data: insertedData, error: insertError } = await supabase
        .from('church_passages')
        .upsert(newPassage, { onConflict: 'date' })
        .select()
        .single();

      if (insertedData) {
        setPassage(insertedData);
      } else {
        // If upsert failed (e.g. race condition), just show the API data
        setPassage(newPassage);
      }
      
    } catch (err) {
      console.error('Error fetching passage:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/10">
        <Loader2 className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!passage) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-6 rounded-2xl border border-indigo-500/30 shadow-lg relative overflow-hidden group">
       <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <BookOpen size={100} />
       </div>
       
       <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-indigo-200 mb-4 border border-white/10">
            <Calendar size={12} />
            <span>Daily Word • {new Date().toLocaleDateString()}</span>
          </div>
          
          <blockquote className="text-xl md:text-2xl font-serif text-white italic leading-relaxed mb-4">
            "{passage.text.trim()}"
          </blockquote>
          
          <cite className="block text-indigo-300 font-bold tracking-wide uppercase text-sm not-italic">
            — {passage.reference}
          </cite>
       </div>
    </div>
  );
}
