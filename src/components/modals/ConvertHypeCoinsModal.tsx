import React, { useEffect, useState } from 'react'
import { useHypeCoins } from '@/lib/hooks/useHypeCoins'
import { useCoins } from '@/lib/hooks/useCoins'
import { toast } from 'sonner'
import { X, Zap, Coins } from 'lucide-react'

interface ConvertHypeCoinsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ConvertHypeCoinsModal({
  isOpen,
  onClose,
}: ConvertHypeCoinsModalProps) {
  const { hypeCoins, convertToTrollCoins, loading: hypeLoading } = useHypeCoins()
  const { troll_coins, refreshCoins } = useCoins()

  const [amount, setAmount] = useState('')
  const [isConverting, setIsConverting] = useState(false)

  const handleAmountChange = (value: string) => {
    if (!value) {
      setAmount('')
      return
    }

    const numValue = parseInt(value, 10)
    if (Number.isNaN(numValue) || numValue < 0) return

    if (numValue > hypeCoins) {
      toast.error(`You only have ${hypeCoins} Hype Coins`)
      setAmount(String(hypeCoins))
      return
    }

    setAmount(value)
  }

  const handleMaxClick = () => {
    setAmount(String(hypeCoins))
  }

  const handleQuickAmount = (value: number) => {
    if (value > hypeCoins) {
      toast.error(`You only have ${hypeCoins} Hype Coins`)
      return
    }
    setAmount(String(value))
  }

  const handleConvert = async () => {
    const numAmount = parseInt(amount, 10)

    if (Number.isNaN(numAmount) || numAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    if (numAmount > hypeCoins) {
      toast.error(`You do not have enough Hype Coins`)
      return
    }

    setIsConverting(true)

    const result = await convertToTrollCoins(numAmount)

    if (result?.success) {
      toast.success(`✓ Converted ${numAmount} Hype Coins to ${numAmount} Troll Coins`)
      setAmount('')
      
      // Refresh troll coins balance
      await refreshCoins()
      
      // Close modal after a short delay for UX
      setTimeout(() => {
        onClose()
      }, 500)
    } else {
      toast.error(result?.message || 'Conversion failed')
    }

    setIsConverting(false)
  }

  useEffect(() => {
    if (!isOpen) {
      setAmount('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const convertAmount = Math.max(0, parseInt(amount, 10) || 0)

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl"
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),rgba(2,6,23,0.98))]" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-cyan-400/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-[0_0_40px_rgba(34,211,238,0.2)]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/30">
            <Zap className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-black text-white">Convert Hype Coins</h2>
            <p className="text-xs text-cyan-200/70">
              Trade your Hype Coins for Troll Coins at 1:1 rate
            </p>
          </div>
        </div>

        {/* Info box */}
        <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
          <p className="text-sm text-cyan-100">
            <span className="font-bold">Conversion rate:</span> 1 Hype Coin = 1 Troll Coin
          </p>
          <p className="mt-1 text-xs text-cyan-200/70">
            Converted Troll Coins count toward your cashout immediately.
          </p>
        </div>

        {/* Balances */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between rounded-lg border border-purple-400/20 bg-purple-500/10 p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-300" />
              <span className="text-sm font-semibold text-purple-100">Hype Coins</span>
            </div>
            <span className="font-mono font-bold text-purple-300">{hypeCoins}</span>
          </div>

          <div className="flex justify-between rounded-lg border border-yellow-400/20 bg-yellow-500/10 p-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-yellow-300" />
              <span className="text-sm font-semibold text-yellow-100">Troll Coins</span>
            </div>
            <span className="font-mono font-bold text-yellow-300">
              {(troll_coins ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
            Amount to Convert
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              min="0"
              max={hypeCoins}
              className="w-full px-4 py-3 rounded-lg border border-cyan-400/30 bg-slate-800/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 font-mono font-bold text-lg"
            />
            <button
              type="button"
              onClick={handleMaxClick}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-xs font-bold text-cyan-300 hover:text-cyan-100 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Quick amounts */}
        {hypeCoins > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-2">
            {[10, 25, hypeCoins].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickAmount(val)}
                disabled={val > hypeCoins}
                className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-800/30 text-sm font-semibold text-slate-300 hover:border-cyan-400/40 hover:bg-slate-700/40 hover:text-cyan-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {val}
              </button>
            ))}
          </div>
        )}

        {/* Preview */}
        {convertAmount > 0 && (
          <div className="mb-6 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-100">
              You will receive <span className="font-bold text-emerald-300">{convertAmount} Troll Coins</span>
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={!amount || parseInt(amount, 10) <= 0 || isConverting || hypeLoading}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold hover:from-cyan-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
          >
            {isConverting ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}
