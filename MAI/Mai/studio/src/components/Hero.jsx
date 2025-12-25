import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, Flame, Film } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative w-screen h-screen overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920&h=1080&fit=crop"
          alt="Cinema Hero"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Cinematic Overlay (Base44 style) */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 h-full flex items-center pt-24">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-16">
          <div className="max-w-2xl">
            {/* Welcome Label */}
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-6 h-6 text-[#FFD700]" />
              <span className="text-[#FFD700] font-bold tracking-widest text-lg">
                WELCOME TO
              </span>
            </div>

            {/* Main Title (ONE LINE like Base44) */}
            <h1 className="text-6xl md:text-8xl font-black mb-6 leading-tight">
              <span className="neon-gold">MAI</span>{" "}
              <span className="neon-red">Studios</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-xl text-gray-200 mb-10 leading-relaxed max-w-xl">
              The next generation streaming platform. Watch exclusive shorts and movies,
              support your favorite creators with MAI Coins.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-4">
              <Link to="/shorts">
                <button className="neon-btn-red text-white px-8 py-4 text-base md:text-lg font-bold rounded-xl flex items-center gap-2 hover:scale-105 transition-transform duration-300">
                  <Flame className="w-5 h-5" />
                  Watch Shorts
                </button>
              </Link>

              <Link to="/movies">
                <button className="bg-white text-black hover:bg-gray-100 px-8 py-4 text-base md:text-lg font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg">
                  <Film className="w-5 h-5" />
                  Browse Movies
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
