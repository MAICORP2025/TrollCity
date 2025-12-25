import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";

interface HeroProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  featured?: boolean;
  ctaText?: string;
  ctaLink?: string;
}

export const Hero = ({
  title = "Welcome to MAI Studios",
  subtitle = "Watch, Create, and Earn Like Never Before",
  backgroundImage = "linear-gradient(135deg, rgba(0, 0, 0, 0.7), rgba(255, 23, 68, 0.2))",
  featured = false,
  ctaText = "Watch Shorts",
  ctaLink = "/shorts",
}: HeroProps) => {
  return (
    <div
      className="relative w-full h-[600px] md:h-[700px] overflow-hidden flex items-center justify-center"
      style={{
        backgroundImage: typeof backgroundImage === "string" && backgroundImage.startsWith("http")
          ? `url('${backgroundImage}')`
          : undefined,
        background: typeof backgroundImage === "string" && !backgroundImage.startsWith("http")
          ? backgroundImage
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Cinematic Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black opacity-60"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-40"></div>

      {/* Neon Light Effects */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-red-500/20 rounded-full blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl opacity-30 animate-pulse"></div>

      {/* Content */}
      <div className="relative z-10 container-wide text-center text-white">
        <div className="max-w-3xl mx-auto">
          {/* Featured Badge */}
          {featured && (
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-yellow-400/20 border border-yellow-400/50 text-yellow-400">
              <Star size={16} />
              <span className="text-sm font-semibold">Featured Content</span>
            </div>
          )}

          {/* Main Title */}
          <h1 className="hero-title mb-4 text-gradient-gold-red">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle mb-8 text-gray-200 max-w-2xl mx-auto">
            {subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              to={ctaLink}
              className="neon-btn-red flex items-center gap-2 group"
            >
              <Play size={20} className="group-hover:scale-110 transition" />
              {ctaText}
            </Link>

            <Link
              to="/movies"
              className="neon-btn-gold flex items-center gap-2 group"
            >
              <span>Browse Movies</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-8 border-t border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">1M+</div>
              <div className="text-xs text-gray-400">Videos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">500K+</div>
              <div className="text-xs text-gray-400">Creators</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">100M+</div>
              <div className="text-xs text-gray-400">Users</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 animate-bounce">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-widest">Scroll to explore</span>
          <svg
            className="w-5 h-5 text-yellow-400 animate-pulse-glow"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};
