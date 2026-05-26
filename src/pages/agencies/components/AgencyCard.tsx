import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';

interface AgencyCardProps {
  agency: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    logo_url: string | null;
    banner_url: string | null;
    owner_id: string;
    status: string;
    default_split_percent: number;
    created_at: string;
  };
}

export function AgencyCard({ agency }: AgencyCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ownerUsername, setOwnerUsername] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const fetchOwnerUsername = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', agency.owner_id)
          .maybeSingle();

        if (!mounted) return;

        if (!error && data?.username) {
          setOwnerUsername(data.username);
        }
      } catch (err) {
        console.error('Error fetching owner username:', err);
      }
    };

    fetchOwnerUsername();

    return () => {
      mounted = false;
    };
  }, [agency.owner_id]);

  const handleApplyClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      alert('Please log in to join a Talent Office');
      return;
    }

    navigate(`/agency-apply/${agency.id}`);
  };

  return (
    <Link
      to={`/agency/${agency.id}`}
      className="block transition-shadow duration-300 hover:shadow-xl"
    >
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm">
        {agency.banner_url && (
          <div
            className="h-24 bg-cover bg-center"
            style={{ backgroundImage: `url(${agency.banner_url})` }}
          />
        )}

        <div className="p-4">
          <div className="mb-2 flex items-center space-x-3">
            {agency.logo_url ? (
              <img
                src={agency.logo_url}
                alt={`${agency.name} logo`}
                className="h-10 w-10 rounded-full border-2 border-cyan-500/30"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-500/30 bg-slate-700">
                <span className="font-bold text-cyan-400">
                  {agency.name.charAt(0)}
                </span>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-white">{agency.name}</h3>
              <p className="text-sm text-slate-400">
                by @{ownerUsername || 'Loading...'}
              </p>
            </div>
          </div>

          {agency.bio && (
            <p className="mb-3 line-clamp-2 text-slate-300">{agency.bio}</p>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-slate-400">
            <div className="flex items-center space-x-1">
              <span className="text-cyan-400">👥</span>
              <span>0 Creators</span>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-blue-400">⏰</span>
              <span>0 hrs/wk</span>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-purple-400">🎁</span>
              <span>0 coins/wk</span>
            </div>

            <div className="flex items-center space-x-1">
              <span className="text-pink-400">⚔️</span>
              <span>0 battles/wk</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-500">Rank: Coming soon</span>

            <button
              type="button"
              className={
                user
                  ? 'rounded border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 text-xs text-cyan-400 hover:bg-cyan-500/30'
                  : 'rounded border border-slate-600/50 bg-slate-700/50 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600/50'
              }
              onClick={handleApplyClick}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default AgencyCard;