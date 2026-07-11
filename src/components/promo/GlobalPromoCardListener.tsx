import { useEffect } from 'react'
import { toast } from 'sonner'
import { Tickets, X, ExternalLink } from 'lucide-react'

type PromoCardIssuedDetail = {
  promo_card_id: string
  code: string
  token_amount: number
  expires_at: string
  source_type: string
}

type PromoCardCooldownDetail = {
  message: string
  next_available_at: string
  source_type: string
}

export default function GlobalPromoCardListener() {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PromoCardIssuedDetail>).detail
      if (!detail?.code) return

      const expiry = new Date(detail.expires_at)
      const isExpired = expiry.getTime() <= Date.now()

      toast.custom(
        (id) => (
          <div className="w-full max-w-sm rounded-2xl border border-purple-400/20 bg-slate-950/95 p-4 text-white shadow-[0_0_35px_rgba(168,85,247,0.2)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-400/25 bg-purple-500/10 text-purple-300">
                <Tickets size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-200">
                    MaiTalent Promo Card Earned
                  </p>
                </div>

                <p className="font-black text-white">{detail.token_amount} Tokens</p>

                <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Promo Code</p>
                  <p className="font-mono text-sm font-bold text-white">{detail.code}</p>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {isExpired
                    ? 'This card has expired'
                    : `Expires: ${expiry.toLocaleString()}`}
                </p>

                <div className="mt-3 flex gap-2">
                  {!isExpired && (
                    <button
                      onClick={() => {
                        toast.dismiss(id)
                        window.open(`https://maitalent.fun/redeem?code=${detail.code}`, '_blank', 'noopener,noreferrer')
                      }}
                      className="rounded-xl bg-purple-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-purple-300"
                    >
                      <span className="flex items-center gap-1">
                        <ExternalLink size={12} />
                        Redeem
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => toast.dismiss(id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"
                  >
                    <span className="flex items-center gap-1">
                      <X size={12} />
                      Close
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ),
        {
          duration: Infinity,
          position: 'top-right',
          style: {
            background: 'transparent',
            border: 'none',
            padding: 0,
            boxShadow: 'none',
          },
        },
      )
    }

    const cooldownHandler = (event: Event) => {
      const detail = (event as CustomEvent<PromoCardCooldownDetail>).detail
      if (!detail?.next_available_at) return

      const nextAvailable = new Date(detail.next_available_at)
      toast.info(
        `Promo card cooldown active. Next ${detail.source_type} promo card available at ${nextAvailable.toLocaleString()}.`,
        { duration: 8000 }
      )
    }

    window.addEventListener('promo-card-issued', handler)
    window.addEventListener('promo-card-cooldown', cooldownHandler)

    return () => {
      window.removeEventListener('promo-card-issued', handler)
      window.removeEventListener('promo-card-cooldown', cooldownHandler)
    }
  }, [])

  return null
}
