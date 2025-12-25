import { useLocation, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ArrowLeft, Zap } from "lucide-react";

export default function Placeholder() {
  const location = useLocation();
  const pageName = location.pathname.split("/").filter(Boolean)[0] || "page";

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full text-center">
          <div className="mb-8">
            <Zap className="mx-auto text-yellow-400 animate-pulse-glow" size={64} />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {pageName.charAt(0).toUpperCase() + pageName.slice(1)}
          </h1>

          <p className="text-gray-400 text-lg mb-8">
            This page is coming soon! We're building something amazing for you.
            Want to help us develop this feature? Let us know in our community!
          </p>

          <div className="space-y-4">
            <div className="card-glow">
              <p className="text-sm text-gray-300">
                💡 Have ideas for what this page should include? Share them with our
                team to shape the future of MAI Studios!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/" className="neon-btn-red flex items-center justify-center gap-2">
                <ArrowLeft size={18} />
                Back Home
              </Link>

              <Link to="/shorts" className="neon-btn-gold">
                Watch Shorts
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-gray-500 text-sm mb-4">Quick Navigation</p>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/"
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium"
              >
                Home
              </Link>
              <Link
                to="/shorts"
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium"
              >
                Shorts
              </Link>
              <Link
                to="/movies"
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium"
              >
                Movies
              </Link>
              <Link
                to="/profile"
                className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium"
              >
                Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
