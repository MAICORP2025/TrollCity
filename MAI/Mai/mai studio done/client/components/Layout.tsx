import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { LogOut, Menu, X, Coins, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { user, isLoading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [_isCheckingCreator, setIsCheckingCreator] = useState(false);

  useEffect(() => {
    const checkCreatorStatus = async () => {
      if (!user) {
        setIsCreator(false);
        return;
      }

      setIsCheckingCreator(true);
      try {
        const response = await fetch(`/api/creator/${user.id}`);
        if (response.ok) {
          setIsCreator(true);
        } else {
          setIsCreator(false);
        }
      } catch {
        setIsCreator(false);
      } finally {
        setIsCheckingCreator(false);
      }
    };

    checkCreatorStatus();
  }, [user]);

  const handleLogout = async () => {
    await logout();
  };

  const navLinks = user && user.role === 'admin' ? [
    { path: "/", label: "Home" },
    { path: "/shorts", label: "Shorts" },
    { path: "/movies", label: "Movies" },
    { path: "/leaderboard", label: "Leaderboard" },
    { path: "/creator-tools", label: "Creator" },
    { path: "/creator-apply", label: "Apply" },
    { path: "/admin-dashboard", label: "Admin" },
  ] : [
    { path: "/", label: "Home" },
    { path: "/shorts", label: "Shorts" },
    { path: "/movies", label: "Movies" },
    { path: "/leaderboard", label: "Leaderboard" },
    ...(user && (isCreator || user.role === 'admin') ? [{ path: "/creator-tools", label: "Creator" }] : []),
    ...(user && !isCreator && user.role !== 'admin' ? [{ path: "/creator-apply", label: "Apply" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-black to-black">
      {/* Header */}
      <header className="header-glass">
        <div className="container-wide">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-red-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative bg-black px-3 py-2 rounded-lg">
                  <span className="text-gradient-gold-red font-black text-lg">MAI</span>
                </div>
              </div>
              <span className="hidden sm:block text-white font-bold text-lg">Studios</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-pill ${
                    location.pathname === link.path
                      ? "bg-yellow-400 text-black"
                      : "border border-white/20 text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {!isLoading && (
                <>
                  {user ? (
                    <>
                      {/* Coin Balance */}
                      <Link
                        to="/coin-store"
                        className="coin-balance hover:bg-yellow-400/20 transition-colors"
                      >
                        <Coins size={18} />
                        <span>{user.coin_balance}</span>
                      </Link>

                      {/* Creator Links Dropdown */}
                      <div className="hidden sm:flex items-center gap-2">
                        <Link
                          to="/upload"
                          className="nav-pill border border-white/20 text-white"
                        >
                          Upload
                        </Link>
                      </div>

                      {/* Profile Menu */}
                      <div className="flex items-center gap-2">
                        <Link
                          to="/settings"
                          className="nav-pill border border-white/20 text-white flex items-center gap-2"
                        >
                          <User size={16} />
                          <span className="hidden sm:block">{user.display_name}</span>
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-red-400 hover:text-red-300"
                          title="Logout"
                        >
                          <LogOut size={18} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <Link
                      to="/signin"
                      className="neon-btn-gold hidden sm:block"
                    >
                      Sign In
                    </Link>
                  )}
                </>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <nav className="md:hidden py-4 border-t border-white/10">
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      location.pathname === link.path
                        ? "bg-yellow-400 text-black font-semibold"
                        : "text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

                {user && (
                  <>
                    <Link
                      to="/coin-store"
                      className="px-4 py-2 rounded-lg text-yellow-400 flex items-center gap-2 hover:bg-white/10"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Coins size={16} />
                      {user.coin_balance} Coins
                    </Link>
                    {!isCreator && user.role !== 'admin' && (
                      <Link
                        to="/creator-apply"
                        className="px-4 py-2 rounded-lg text-white hover:bg-white/10"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Apply to be Creator
                      </Link>
                    )}
                    <Link
                      to="/upload"
                      className="px-4 py-2 rounded-lg text-white hover:bg-white/10"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Upload
                    </Link>
                    <Link
                      to="/dashboard"
                      className="px-4 py-2 rounded-lg text-white hover:bg-white/10"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Creator Dashboard
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        to="/admin-dashboard"
                        className="px-4 py-2 rounded-lg text-red-400 hover:bg-white/10"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Admin Dashboard
                      </Link>
                    )}
                  </>
                )}

                {!user && (
                  <Link
                    to="/signin"
                    className="px-4 py-2 rounded-lg neon-btn-gold text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20 bg-black/80">
        <div className="container-wide section-padding">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="text-gradient-gold-red font-black text-xl mb-2">
                MAI Studios
              </div>
              <p className="text-gray-400 text-sm">
                Watch, create, and earn with the ultimate streaming platform.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h3 className="font-semibold text-white mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link to="/" className="hover:text-yellow-400 transition">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/shorts" className="hover:text-yellow-400 transition">
                    Shorts
                  </Link>
                </li>
                <li>
                  <Link to="/movies" className="hover:text-yellow-400 transition">
                    Movies
                  </Link>
                </li>
              </ul>
            </div>

            {/* Creators */}
            <div>
              <h3 className="font-semibold text-white mb-4">For Creators</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link to="/upload" className="hover:text-yellow-400 transition">
                    Upload Content
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-yellow-400 transition">
                    Creator Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link to="/terms" className="hover:text-yellow-400 transition">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-yellow-400 transition">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>&copy; 2024 MAI Studios. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
