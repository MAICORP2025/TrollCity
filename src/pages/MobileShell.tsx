import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../lib/store";
import { hasRole, UserRole } from "../lib/supabase";
import { Shield, Crown } from "lucide-react";
import BottomNav from "./BottomNav";

export default function MobileShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect immersive pages (broadcast / live room)
  const isImmersive =
    location.pathname.startsWith("/broadcast") ||
    location.pathname.startsWith("/live-room");

  useEffect(() => {
    if (!user) navigate("/login", { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  if (!profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#05010a] text-white/70">
        <div className="animate-pulse">Loading profile...</div>
      </div>
    );
  }

  const isAdmin = hasRole(profile as any, UserRole.ADMIN);
  const isOfficer = hasRole(
    profile as any,
    [UserRole.TROLL_OFFICER, UserRole.LEAD_TROLL_OFFICER],
    { allowAdminOverride: true }
  );

  return (
    <div className="mobile-shell">
      {/* Header hidden during immersive mode */}
      {!isImmersive && (
        <div className="mobile-header">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">
                Troll City
              </div>
              <div className="text-lg font-bold text-white">
                Mobile Control Center
              </div>
            </div>

            <div className="flex flex-col items-end text-right">
              <div className="text-sm font-semibold text-white truncate max-w-[120px]">
                {profile.username || profile.email || "User"}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-white/50">
                {isAdmin ? (
                  <>
                    <Crown className="w-3 h-3 text-yellow-400" />
                    <span>Admin</span>
                  </>
                ) : isOfficer ? (
                  <>
                    <Shield className="w-3 h-3 text-emerald-400" />
                    <span>Officer</span>
                  </>
                ) : (
                  <span>Viewer</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className={`mobile-content ${
          isImmersive ? "immersive-content" : ""
        }`}
      >
        {children}
      </div>

      {/* Bottom Nav hidden during immersive mode */}
      {!isImmersive && <BottomNav />}
    </div>
  );
}