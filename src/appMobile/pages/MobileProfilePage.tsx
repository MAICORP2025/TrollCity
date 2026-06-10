import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Coins,
  Crown,
  Edit3,
  Flame,
  Gift,
  Heart,
  MessageCircle,
  Radio,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import MobilePageShell from "../MobilePageShell";
import { supabase } from "@/integrations/supabase/client";
import { normalizeMobileRole, type MobileUserRole } from "../mobileRoutes";

type MobileProfile = {
  id: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  role: MobileUserRole;
  bio: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  trollCoins: number;
  hypeCoins: number;
  trollmonds: number;
  followers: number;
  following: number;
  likes: number;
  broadcasts: number;
};

const DEFAULT_PROFILE: MobileProfile = {
  id: null,
  username: "Guest",
  displayName: "Guest",
  avatarUrl: null,
  bannerUrl: null,
  role: "user",
  bio: "Welcome to my Troll City profile.",
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  trollCoins: 0,
  hypeCoins: 0,
  trollmonds: 0,
  followers: 0,
  following: 0,
  likes: 0,
  broadcasts: 0,
};

const badges = [
  {
    label: "City Member",
    icon: BadgeCheck,
  },
  {
    label: "Gift Ready",
    icon: Gift,
  },
  {
    label: "Hype Builder",
    icon: Zap,
  },
  {
    label: "Level Climber",
    icon: Crown,
  },
];

const quickActions = [
  {
    label: "Edit Profile",
    path: "/profile/edit",
    icon: Edit3,
  },
  {
    label: "Wallet",
    path: "/wallet",
    icon: Wallet,
  },
  {
    label: "Messages",
    path: "/messages",
    icon: MessageCircle,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

function numberFormat(value: number): string {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function getNumberValue(source: any, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== null && value !== undefined && value !== "") {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) return numeric;
    }
  }

  return fallback;
}

function getStringValue(source: any, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = source?.[key];

    if (typeof value === "string && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}