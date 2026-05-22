import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Message } from '../../hooks/useStreamChat';
import UserNameWithAge from '../UserNameWithAge';
import { Crown, Shield, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FloatingChatOverlayProps {
  messages: Message[];
  streamMods: string[];
  hostId: string;
}

type ChatProfile = {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  troll_role?: string | null;
  user_role?: string | null;
  user_troll_role?: string | null;
  created_at?: string | null;
  rgb_username_expires_at?: string | null;
  glowing_username_color?: string | null;
};

type FloatingMessage = Message & {
  username?: string | null;
  user_name?: string | null;
  display_name?: string | null;
  message?: string | null;
  content?: string | null;
  role?: string | null;
  troll_role?: string | null;
  user_role?: string | null;
  user_troll_role?: string | null;
  user_created_at?: string | null;
  user_glowing_username_color?: string | null;
  user_rgb_expires_at?: string | null;
  user_profiles?: ChatProfile | null;
  user?: ChatProfile | null;
};

function resolveUsername(msg: Message, fallback = 'Troll Citizen') {
  const m = msg as FloatingMessage;

  return (
    m.user_profiles?.username ||
    m.user_profiles?.display_name ||
    m.user?.username ||
    m.user?.display_name ||
    m.username ||
    m.user_name ||
    m.display_name ||
    fallback
  );
}

function resolveContent(msg: Message) {
  const m = msg as FloatingMessage;
  return m.content || m.message || '';
}

function resolveRole(msg: Message) {
  const m = msg as FloatingMessage;

  return (
    m.user_profiles?.role ||
    m.user_profiles?.user_role ||
    m.user?.role ||
    m.user?.user_role ||
    m.role ||
    m.user_role ||
    undefined
  );
}

function resolveTrollRole(msg: Message) {
  const m = msg as FloatingMessage;

  return (
    m.user_profiles?.troll_role ||
    m.user_profiles?.user_troll_role ||
    m.user?.troll_role ||
    m.user?.user_troll_role ||
    m.troll_role ||
    m.user_troll_role ||
    undefined
  );
}

function resolveCreatedAt(msg: Message) {
  const m = msg as FloatingMessage;

  return (
    m.user_profiles?.created_at ||
    m.user?.created_at ||
    m.user_created_at ||
    undefined
  );
}

function resolveRgbExpiresAt(msg: Message) {
  const m = msg as FloatingMessage;

  return (
    m.user_profiles?.rgb_username_expires_at ||
    m.user?.rgb_username_expires_at ||
    m.user_rgb_expires_at ||
    undefined
  );
}

function resolveGlowingColor(msg: Message) {
  const m = msg as FloatingMessage;

  return (
    m.user_profiles?.glowing_username_color ||
    m.user?.glowing_username_color ||
    m.user_glowing_username_color ||
    undefined
  );
}

export const FloatingChatOverlay: React.FC<FloatingChatOverlayProps> = ({
  messages,
  streamMods = [],
  hostId,
}) => {
  const renderBadge = (
    userId?: string | null,
    role?: string | null,
    trollRole?: string | null
  ) => {
    if (userId && userId === hostId) {
      return <Crown size={12} className="text-yellow-500 inline mr-1" />;
    }

    if (userId && streamMods.includes(userId)) {
      return <Shield size={12} className="text-green-500 inline mr-1" />;
    }

    const normalizedRole = String(role || trollRole || '').toLowerCase();

    if (!normalizedRole) return null;

    if (
      normalizedRole === 'admin' ||
      normalizedRole === 'staff' ||
      normalizedRole === 'ceo'
    ) {
      return <Shield size={12} className="text-red-500 inline mr-1" />;
    }

    if (
      normalizedRole === 'officer' ||
      normalizedRole === 'broadofficer' ||
      normalizedRole === 'troll_officer'
    ) {
      return <Shield size={12} className="text-blue-500 inline mr-1" />;
    }

    if (
      normalizedRole === 'host' ||
      normalizedRole === 'creator'
    ) {
      return <Crown size={12} className="text-yellow-500/50 inline mr-1" />;
    }

    return null;
  };

  return (
    <div className="absolute bottom-20 left-4 z-50 pointer-events-none flex w-[min(420px,calc(100%-2rem))] flex-col items-start overflow-hidden">
      <AnimatePresence initial={false}>
        {messages.map((msg) => {
          const username = resolveUsername(msg);
          const content = resolveContent(msg);
          const role = resolveRole(msg);
          const trollRole = resolveTrollRole(msg);
          const createdAt = resolveCreatedAt(msg);
          const rgbExpiresAt = resolveRgbExpiresAt(msg);
          const glowingColor = resolveGlowingColor(msg);

          return (
            <motion.div
              key={msg.id}
              layout
              initial={{ opacity: 0, y: 50, x: -20 }}
              animate={{
                opacity: 1,
                y: 0,
                x: 0,
                transition: {
                  type: 'spring',
                  damping: 10,
                  stiffness: 100,
                },
              }}
              exit={{
                opacity: 0,
                y: -50,
                transition: { duration: 0.5 },
              }}
              transition={{ duration: 0.5 }}
              className={cn(
                'mb-2 p-2 rounded-lg shadow-lg text-white max-w-[70%] text-sm break-words',
                'bg-black/60 backdrop-blur-sm border border-white/10',
                msg.type === 'system' ? 'italic text-zinc-300' : 'font-medium',
                'pointer-events-auto'
              )}
            >
              {msg.type === 'system' ? (
                <div className="flex items-center gap-1">
                  <Sparkles
                    size={12}
                    className="text-yellow-500 flex-shrink-0"
                  />

                  <span className="font-bold text-zinc-300">
                    {username || 'Guest'}
                  </span>

                  <span>{content}</span>
                </div>
              ) : (
                <div className="flex items-start">
                  <span className="flex-shrink-0">
                    {renderBadge(msg.user_id, role, trollRole)}

                    <UserNameWithAge
                      username={username}
                      createdAt={createdAt}
                      rgbExpiresAt={rgbExpiresAt}
                      glowingColor={glowingColor}
                    />
                    :
                  </span>

                  <span className="ml-1 flex-grow">
                    {content}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};