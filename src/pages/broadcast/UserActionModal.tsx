            {canMod && (
              <div className="grid grid-cols-2 gap-2 w-full mt-4">
                <button onClick={onMute} className="py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-bold transition-colors">
                  MUTE
                </button>
                <button onClick={onKick} className="py-2 bg-orange-700 hover:bg-orange-600 rounded-lg text-xs font-bold transition-colors">
                  KICK
                </button>
                <button onClick={onArrest} className="col-span-2 py-3 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-black transition-all shadow-lg shadow-red-900/20">
                  ⚖️ ARREST (15 MINS)
                </button>
                <button onClick={onBlock} className="col-span-2 py-2 border border-gray-600 hover:bg-white/5 rounded-lg text-xs transition-colors">
                  ANTI-BAN SHIELD
                </button>
              </div>
            )}