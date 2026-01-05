import { X, Coins } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../lib/store";

const gifts = [
  { id: 0, name: "Troll", emoji: "🧟", coins: 1, rarity: 'troll' },
  { id: 1, name: "Rose", emoji: "🌹", coins: 10, rarity: 'common' },
  { id: 2, name: "Heart", emoji: "💗", coins: 50, rarity: 'common' },
  { id: 3, name: "Diamond", emoji: "💎", coins: 100, rarity: 'rare' },
  { id: 4, name: "Crown", emoji: "👑", coins: 500, rarity: 'legendary' },
  { id: 5, name: "Fireworks", emoji: "🎆", coins: 1000, rarity: 'legendary' },
  { id: 6, name: "Rocket", emoji: "🚀", coins: 5000, rarity: 'legendary' },
];

export default function GiftModal({ onClose, onSendGift, recipientName }) {
  const [selectedGift, setSelectedGift] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const handleSendGift = () => {
    if (!selectedGift) return;
    const giftPayload = { ...selectedGift, quantity };
    if (typeof onSendGift === 'function') onSendGift(giftPayload);
    setQuantity(1);
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full purple-neon max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">SELECT GIFT</h2>
            {recipientName && <p className="text-xs text-purple-400">for {recipientName}</p>}
          </div>
          <div className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full border border-yellow-500/30">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm">
              {profile?.troll_coins?.toLocaleString() || 0}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {gifts.map((gift) => (
            <button
              key={gift.id}
              onClick={() => setSelectedGift(gift)}
              className={`p-4 rounded-lg transition-all transform hover:scale-105 ${
                selectedGift?.id === gift.id
                  ? "bg-purple-600 ring-2 ring-purple-400"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              <div className="text-3xl mb-2">{gift.emoji}</div>
              <div className="text-xs font-bold mb-1">{gift.name}</div>
              <div className="text-xs text-yellow-400">{gift.coins} coins</div>
            </button>
          ))}
        </div>
        {selectedGift && (
          <div className="mb-4 p-3 bg-gray-800 rounded">
            <label className="text-sm font-bold block mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="flex-1 bg-gray-700 text-white text-center py-1 rounded"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
              >
                +
              </button>
            </div>
            <div className="mt-2 text-right text-sm">
              Total:{" "}
              <span className="font-bold text-yellow-400">
                {(selectedGift.coins * quantity).toLocaleString()} coins
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleSendGift}
          disabled={!selectedGift}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-700 hover:to-red-700 disabled:opacity-50 rounded-lg font-bold transition-all"
        >
          {selectedGift ? `Send ${selectedGift.emoji}` : "Select a Gift"}
        </button>
      </div>
    </div>
  );
}
