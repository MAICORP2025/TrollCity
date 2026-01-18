import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ROLE_BASED_ENTRANCE_EFFECTS } from "../../lib/entranceEffects";
import Avatar3D from "../avatar/Avatar3D";
import type { AvatarConfig } from "../../lib/hooks/useAvatar";
import { getUserAvatarConfig } from "../../lib/purchases";

interface EntranceEffectProps {
  username: string;
  role: string;
  profile?: {
    rgb_username_expires_at?: string;
  };
  userId?: string;
  avatarConfig?: AvatarConfig;
}

export default function EntranceEffect({ username, role, profile, userId, avatarConfig }: EntranceEffectProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [avatarConfigState, setAvatarConfigState] = useState<AvatarConfig | null>(avatarConfig || null);

  const roleConfig = ROLE_BASED_ENTRANCE_EFFECTS[role];
  const fallbackEmoji = (roleConfig as any)?.emoji || "dY`<";
  const fallbackLabel = (roleConfig as any)?.label || "Viewer";
  const fallbackColor = (roleConfig as any)?.color || "#22c55e";

  const hasRgb = useMemo(() => {
    return Boolean(
      profile?.rgb_username_expires_at &&
        new Date(profile.rgb_username_expires_at) > new Date()
    );
  }, [profile]);

  useEffect(() => {
    setAvatarConfigState(avatarConfig || null);
  }, [avatarConfig]);

  useEffect(() => {
    let active = true;
    if (!userId || avatarConfig) return;

    const loadAvatar = async () => {
      try {
        const data = await getUserAvatarConfig(userId);
        if (!active) return;
        if (data?.avatar_config) {
          setAvatarConfigState(data.avatar_config as AvatarConfig);
        }
      } catch {
      }
    };

    void loadAvatar();
    return () => {
      active = false;
    };
  }, [userId, avatarConfig]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="entrance-effect"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2"
      >
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/70 px-6 py-2 text-white shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-lg">
          {avatarConfigState ? (
            <div className="flex items-center justify-center">
              <Avatar3D config={avatarConfigState} size="sm" />
            </div>
          ) : (
            <span className="text-2xl">{fallbackEmoji}</span>
          )}
          <div className="flex flex-col leading-tight">
            <span
              className={`text-sm font-semibold uppercase tracking-[0.4em] ${hasRgb ? "rgb-username" : ""}`}
              style={{ color: hasRgb ? undefined : fallbackColor }}
            >
              {username.toUpperCase()}
            </span>
            <span className="text-xs text-white/70">{fallbackLabel} has entered the stream</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
