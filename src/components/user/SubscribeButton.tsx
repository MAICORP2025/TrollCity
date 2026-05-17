import React, { useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Crown, Heart, Loader2, Check, X } from 'lucide-react';
import SubscriptionTierSelector from './SubscriptionTierSelector';

interface SubscribeButtonProps {
  broadcasterId: string;
  broadcasterUsername: string;
  currentSubscription?: any;
  onSubscribe?: (tierId: string) => void;
  onUnsubscribe?: () => void;
  onProfileClick?: () => void;
}

const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  broadcasterId,
  broadcasterUsername,
  currentSubscription,
  onSubscribe,
  onUnsubscribe
}) => {
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showTierSelector, setShowTierSelector] = useState(false);
  
  const currentLevel = profile?.level || 0;
  const isSubscribed = !!currentSubscription;
  const canSubscribe = user && currentLevel >= 10;

  const handleUnsubscribe = async () => {
    if (!confirm(`Unsubscribe from ${broadcasterUsername}? You'll lose subscriber benefits immediately.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('unsubscribe_from_broadcaster', {
        p_subscriber_id: user.id,
        p_broadcaster_id: broadcasterId
      });
      
      if (error) throw error;
      toast.success(`Unsubscribed from ${broadcasterUsername}`);
      onUnsubscribe?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeClick = () => {
    if (!canSubscribe) {
      if (currentLevel < 10) {
        toast.error('Subscriptions unlocked at Level 10. Keep engaging to level up!');
      } else {
        toast.error('Please log in to subscribe');
      }
      return;
    }

    if (isSubscribed) {
      handleUnsubscribe();
    } else {
      setShowTierSelector(true);
    }
  };

  const getButtonStyle = () => {
    if (isSubscribed) {
      return 'bg-green-600 hover:bg-green-500 text-white';
    }
    if (!canSubscribe) {
      return 'bg-gray-600 text-gray-400 cursor-not-allowed';
    }
    return 'bg-cyan-600 hover:bg-cyan-500 text-white';
  };

  const getButtonText = () => {
    if (loading) return '...';
    if (isSubscribed) return `Subscribed ${currentSubscription?.tier?.name ? `(${currentSubscription.tier.name})` : ''} ✓`;
    if (currentLevel < 10) return `Level ${currentLevel}/10 to Subscribe`;
    return 'Subscribe';
  };

  return (
    <>
      <button
        onClick={handleSubscribeClick}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${getButtonStyle()}`}
        title={isSubscribed ? 'Click to unsubscribe' : 'Subscribe to support this creator'}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSubscribed ? (
          <>
            <Crown className="w-4 h-4" />
            {getButtonText()}
          </>
        ) : (
          <>
            <Heart className="w-4 h-4" />
            {getButtonText()}
          </>
        )}
      </button>

      {showTierSelector && (
        <SubscriptionTierSelector
          broadcasterId={broadcasterId}
          broadcasterUsername={broadcasterUsername}
          onClose={() => setShowTierSelector(false)}
          onSelect={(tierId) => {
            setShowTierSelector(false);
            onSubscribe?.(tierId);
          }}
        />
      )}
    </>
  );
};

export default SubscribeButton;
