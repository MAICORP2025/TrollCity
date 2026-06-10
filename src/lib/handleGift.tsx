import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { getUserAffiliation, UserAffiliation } from '../../lib/userAffiliations';
import { useNavigate } from 'react-router-dom';
import { 
  User, MessageCircle, Gift, Flag, Camera, 
  Crown, Check, X, Heart, Users, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import SubscribeButton from './SubscribeButton';

interface UserMiniProfileProps {
  userId: string;
  username: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  isLive?: boolean;
  liveStreamId?: string;
  onClose: () => void;
}

const UserMiniProfile: React.FC<UserMiniProfileProps> = ({
  userId,
  username,
  avatarUrl,
  coverImageUrl,
  isLive,
  liveStreamId,
  onClose
}) => {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [affiliation, setAffiliation] = useState<UserAffiliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false); // placeholder for future follow system

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    fetchProfile();
    fetchAffiliation();

    if (user && !isOwnProfile) {
      checkSubscription();
      checkFollowing();
    }
  }, [userId, user]);

  const fetchProfile = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setTargetProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAffiliation = async () => {
    try {
      const data = await getUserAffiliation(userId);
      setAffiliation(data);
    } catch (error) {
      console.error('Error fetching affiliation:', error);
    }
  };

  const checkSubscription = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          tier: subscription_tiers(*)
        `)
        .eq('subscriber_id', user.id)
        .eq('broadcaster_id', userId)
        .eq('is_active', true)
        .single();
      setSubscription(data);
    } catch (error) {
      // No subscription
    }
  };

  const checkFollowing = async () => {
    if (!user) return;
    // Placeholder: implement follow table later
    // For now, just set false
    setFollowing(false);
  };

  const handleGift = () => {
    if (liveStreamId) {
      navigate(`/broadcast/${liveStreamId}?gift_to=${userId}`);
    } else {
      toast.error('Cannot gift: user is not live');
    }
    onClose();
  };

  const handleMessage = () => {
    navigate(`/messages?to=${username}`);
    onClose();
  };

  const handleReport = () => {
    // TODO: Open report modal
    toast.info('Report feature coming soon');
  };

  const handleViewProfile = () => {
    navigate(`/profile/${username}`);
    onClose();
  };

  const handleFollow = () => {
    // Placeholder for follow system
    toast.info('Follow feature coming soon');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
          <p className="text-center mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Cover Image */}
        {coverImageUrl || targetProfile?.cover_image_url ? (
          <img 
            src={coverImageUrl || targetProfile?.cover_image_url} 
            alt="Cover" 
            className="w-full h-20 object-cover"
          />
        ) : (
          <div className="w-full h-20 bg-gradient-to-r from-purple-900 to-slate-900" />
        )}

        {/* Profile Section */}
        <div className="px-4 pb-4">
          <div className="flex items-end gap-3 -mt-8 mb-3">
            <img
              src={avatarUrl || targetProfile?.avatar_url || '/default-avatar.png'}
              alt={username}
              className="w-16 h-16 rounded-full border-4 border-slate-900 bg-slate-800 object-cover"
            />
            <div className="flex-1 min-w-0 mt-8">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white truncate text-lg">{username}</h3>
                {targetProfile?.is_verified && (
                  <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">✓</span>
                )}
                {subscription && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ 
                      backgroundColor: subscription.tier?.color_hex + '30',
                      color: subscription.tier?.color_hex 
                    }}
                  >
                    <Crown className="w-3 h-3 inline mr-1" />
                    {subscription.tier?.name}
                  </span>
                )}
                {following && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400">
                    Following
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Level {targetProfile?.level} • {targetProfile?.monthly_subscriber_count || 0} subscribers
              </p>
            </div>
          </div>

          {/* Stats Row */}
          {(targetProfile?.troll_coins !== undefined || targetProfile?.crowns !== undefined) && (
            <div className="flex gap-4 mb-3 text-xs text-slate-300">
              {targetProfile?.troll_coins !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">🪙</span> {targetProfile.troll_coins.toLocaleString()}
                </div>
              )}
              {targetProfile?.crowns !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-purple-400">👑</span> {targetProfile.crowns}
                </div>
              )}
            </div>
          )}

          {affiliation && (
            <div className="mb-3 text-xs text-slate-300">
              <span className="font-semibold text-white">
                {affiliation.type === 'agency' ? 'Agency' : 'Family'}:
              </span>{' '}
              {affiliation.name}
              {affiliation.role ? (
                <span className="text-slate-400"> • {affiliation.role}</span>
              ) : null}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {!isOwnProfile ? (
              <>
                <SubscribeButton
                  broadcasterId={userId}
                  broadcasterUsername={username}
                  currentSubscription={subscription}
                />
                <button
                  onClick={handleFollow}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
                >
                  <Users className="w-4 h-4" />
                  Follow
                </button>
                <button
                  onClick={handleMessage}
                  disabled={!targetProfile?.can_message && targetProfile?.can_message !== undefined}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm"
                  title={targetProfile?.can_message === false ? 'This user does not accept messages' : ''}
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
                <button
                  onClick={handleGift}
                  disabled={!isLive}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm"
                >
                  <Gift className="w-4 h-4" />
                  Gift
                </button>
                <button
                  onClick={handleReport}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 rounded-lg text-sm"
                >
                  <Flag className="w-4 h-4" />
                  Report User
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleViewProfile}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  <User className="w-4 h-4" />
                  View My Profile
                </button>
                <button
                  onClick={() => { onClose(); navigate('/settings'); }}
                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  <Camera className="w-4 h-4" />
                  Edit Profile
                </button>
              </>
            )}
          </div>

          {affiliation && !isOwnProfile && (
            <div className="grid grid-cols-1 gap-2 mb-3">
              {affiliation.type === 'family' ? (
                <button
                  onClick={() => {
                    navigate(`/family/profile/${affiliation.id}`)
                    onClose()
                  }}
                  className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
                >
                  Join Family
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      navigate(`/agency/${affiliation.slug || affiliation.id}`)
                      onClose()
                    }}
                    className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm"
                  >
                    View Agency
                  </button>
                  <button
                    onClick={() => {
                      navigate(`/agency-apply/${affiliation.slug || affiliation.id}`)
                      onClose()
                    }}
                    className="w-full px-3 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-sm"
                  >
                    Apply to Join
                  </button>
                </>
              )}
            </div>
          )}

          {/* Subscriber badge if subscribed to this person */}
          {targetProfile?.subscriber_badge_color_hex && !isOwnProfile && (
            <div className="text-center">
              <span 
                className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{
                  backgroundColor: targetProfile.subscriber_badge_color_hex + '20',
                  color: targetProfile.subscriber_badge_color_hex
                }}
              >
                <Crown className="w-3 h-3 inline mr-1" />
                Official Supporter
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserMiniProfile;
