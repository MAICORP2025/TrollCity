import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabaseApi } from "@/api/supabaseApi";
import { supabaseClient } from "@/lib/supabaseClient";

import {
  Home,
  Play,
  Film,
  Coins,
  User,
  Upload,
  Menu,
  X,
  LogOut,
  Shield,
  TrendingUp,
  Sparkles,
  MessageCircle,
  Crown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // ✅ Load full profile-style user (auth + profiles merged like Base44)
  const loadUser = async () => {
    try {
      const userData = await supabaseApi.auth.me();
      setUser(userData);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadUser();
    };
    init();

    // ✅ Reactively listen for auth changes
    const { data: listener } = supabaseClient.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabaseApi.auth.logout();
    setUser(null);
  };

  const navItems = [
    { name: "Home", page: "Home", icon: Home },
    { name: "Shorts", page: "Shorts", icon: Play },
    { name: "Movies", page: "Movies", icon: Film },
    { name: "Coin Store", page: "CoinStore", icon: Coins },
    { name: "Leaderboard", page: "Leaderboard", icon: TrendingUp },
  ];

  const userNavItems = user
    ? [
        { name: "My Profile", page: "Profile", icon: User },
        { name: "Messages", page: "Messages", icon: MessageCircle },
        ...(user.is_creator ? [{ name: "Upload", page: "Upload", icon: Upload }] : []),
        ...(user.is_creator
          ? [{ name: "Creator Dashboard", page: "CreatorDashboard", icon: TrendingUp }]
          : []),
        ...(user.is_creator ? [{ name: "Manage VIP", page: "ManageVIP", icon: Crown }] : []),
        ...(user.role === "admin" ? [{ name: "Admin", page: "Admin", icon: Shield }] : []),
      ]
    : [];

  // ✅ Special page bypass (keeps Base44 clean page style)
  if (currentPageName === "TermsAgreement") {
    return (
      <div className="min-h-screen bg-black text-white">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ✅ HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-[#FFD700]/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link to={createPageUrl("Home")} className="flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-[#FFD700]" />
            <span className="text-2xl font-bold neon-gold tracking-wider">
              MAI Studios
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300",
                  currentPageName === item.page
                    ? "text-[#FFD700] bg-[#FFD700]/10"
                    : "text-gray-400 hover:text-[#FFD700] hover:bg-[#FFD700]/5"
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* User Section */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/5">
                  <Coins className="w-4 h-4 text-[#FFD700]" />
                  <span className="text-[#FFD700] font-semibold">
                    {user.coin_balance || 0}
                  </span>
                </div>

                {userNavItems.map((item) => (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={cn(
                      "p-2 rounded-lg transition-all duration-300",
                      currentPageName === item.page
                        ? "text-[#FFD700] bg-[#FFD700]/10"
                        : "text-gray-400 hover:text-[#FFD700]"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </Link>
                ))}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="text-gray-400 hover:text-[#FF1744]"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <Button
                onClick={() => window.location.href = "/login"}
                className="neon-btn-gold text-black font-semibold px-6"
              >
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-[#FFD700]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-black/95 border-t border-[#FFD700]/20 py-4 px-4">
            {user && (
              <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg border border-[#FFD700]/30 bg-[#FFD700]/5">
                <Coins className="w-5 h-5 text-[#FFD700]" />
                <span className="text-[#FFD700] font-semibold">
                  {user.coin_balance || 0} MAI Coins
                </span>
              </div>
            )}
            <nav className="space-y-2">
              {[...navItems, ...userNavItems].map((item) => (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                    currentPageName === item.page
                      ? "text-[#FFD700] bg-[#FFD700]/10"
                      : "text-gray-400 hover:text-[#FFD700]"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}

              {user ? (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#FF1744] hover:bg-[#FF1744]/10 w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <Button
                  onClick={() => window.location.href = "/login"}
                  className="w-full neon-btn-gold text-black font-semibold mt-4"
                >
                  Sign In
                </Button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ✅ MAIN */}
      <main className="pt-20 min-h-screen">{children}</main>

      {/* ✅ FOOTER */}
      <footer className="bg-black border-t border-[#FFD700]/20 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#FFD700]" />
              <span className="text-lg font-bold neon-gold">
                MAI Studios
              </span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link to={createPageUrl("Policies")} className="hover:text-[#FFD700]">
                Policies
              </Link>
              <Link to={createPageUrl("TermsAgreement")} className="hover:text-[#FFD700]">
                Terms of Use
              </Link>
              <Link to={createPageUrl("BecomeCreator")} className="hover:text-[#FF1744]">
                Become a Creator
              </Link>
            </div>
          </div>
          <p className="text-center text-gray-600 text-sm mt-6">
            © 2025 MAI Studios. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
