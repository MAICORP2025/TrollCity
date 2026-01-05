import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, AlertTriangle } from 'lucide-react'

export default function TrollsNightRules() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#050012] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-purple-900/20 rounded-full border border-purple-500/30">
            <Shield className="w-12 h-12 text-purple-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            TROLLS@NIGHT — OFFICIAL RULES
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            These rules are final. Violations result in immediate bans. By accessing Trolls@Night, you agree to everything below.
          </p>
        </div>

        {/* 1) GENERAL RULES */}
        <section className="space-y-4 bg-[#0F0F1A] p-6 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-blue-400">
            <span className="text-3xl">🌙</span> 1) GENERAL RULES (EVERYONE)
          </h2>
          <ul className="space-y-2 text-gray-300 list-disc pl-5">
            <li><strong className="text-white">Respect the community.</strong> Harassment, threats, or targeted bullying is not allowed.</li>
            <li><strong className="text-white">No hate speech.</strong> Racism, sexism, slurs, or extremist content results in immediate action.</li>
            <li><strong className="text-white">No doxxing.</strong> Sharing or threatening to share private info is an instant ban.</li>
            <li><strong className="text-white">No illegal activity.</strong> Do not stream or promote anything illegal.</li>
            <li><strong className="text-white">No explicit sexual content.</strong> Trolls@Night is nightlife-themed but must remain safe and non-explicit.</li>
            <li><strong className="text-white">No minors in adult areas.</strong> Trolls@Night is intended for mature audiences only. If minors appear or are suspected, the stream will be removed.</li>
            <li><strong className="text-white">No impersonation.</strong> Do not pretend to be admin, officers, or other users.</li>
            <li><strong className="text-white">No scams or fraud.</strong> Any tricking, fake giveaways, or financial deception is banned.</li>
            <li><strong className="text-white">No weapon displays or threats.</strong> Anything involving weapons used to threaten people is not allowed.</li>
            <li><strong className="text-white">Follow Troll City rules.</strong> Trolls@Night is a premium zone but still part of Troll City.</li>
          </ul>
        </section>

        {/* 2) VIEWER RULES */}
        <section className="space-y-4 bg-[#0F0F1A] p-6 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-green-400">
            <span className="text-3xl">✅</span> 2) VIEWER RULES (WATCHERS)
          </h2>
          <ul className="space-y-2 text-gray-300 list-disc pl-5">
            <li><strong className="text-white">Entry Pass required</strong> to watch full streams (see Entry Pass rules below).</li>
            <li><strong className="text-white">Chat is locked</strong> until Entry Pass is paid. Preview watchers cannot chat.</li>
            <li><strong className="text-white">No harassment in chat.</strong> Troll jokes are allowed, but personal attacks are not.</li>
            <li><strong className="text-white">No spam.</strong> No repeated messages, flooding emojis, or disruptive behavior.</li>
            <li><strong className="text-white">No advertising.</strong> No promoting other apps, links, or services without permission.</li>
            <li><strong className="text-white">No sharing real personal info.</strong> Don’t ask for addresses, phone numbers, etc.</li>
            <li><strong className="text-white">Respect stream rules.</strong> If the broadcaster sets stream rules, follow them.</li>
            <li><strong className="text-white">No chargeback / coin fraud.</strong> Any coin exploit attempts are permanent bans.</li>
          </ul>
        </section>

        {/* 3) BROADCASTER RULES */}
        <section className="space-y-4 bg-[#0F0F1A] p-6 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-red-400">
            <span className="text-3xl">🎙️</span> 3) BROADCASTER RULES (STREAMERS)
          </h2>
          <ul className="space-y-2 text-gray-300 list-disc pl-5">
            <li><strong className="text-white">Broadcasting is a privilege, not a right.</strong></li>
            <li><strong className="text-white">Broadcaster Mode must be activated</strong> to stream (2,000 coins).</li>
            <li>Broadcasters must follow all general rules and cannot encourage rule-breaking.</li>
            <li><strong className="text-white">No explicit sexual content</strong> (nudity, pornography, explicit acts, or sexual services).</li>
            <li><strong className="text-white">No illegal streams.</strong> No drugs, crimes, scams, or illegal transactions.</li>
            <li><strong className="text-white">No forced pay exploitation.</strong> Broadcasters cannot end streams repeatedly to force users to repay Entry Pass. This is considered exploit behavior and results in suspension.</li>
            <li><strong className="text-white">No fake streams or misleading content.</strong></li>
            <li><strong className="text-white">No recorded stolen content</strong> (movies, copyrighted TV, etc.)</li>
            <li><strong className="text-white">No gambling streams</strong> unless permitted by Troll City rules.</li>
            <li><strong className="text-white">No impersonating staff</strong> or fake “official” announcements.</li>
            <li>Broadcasters must accept TrollCourt rulings and cooperate with moderation requests.</li>
            <li>Broadcasters may not abuse viewers by demanding gifts or threatening bans.</li>
            <li>Streamers must keep chat safe. If the stream becomes unsafe, officers can lock or end it.</li>
          </ul>
        </section>

        {/* 4) ENTRY PASS + ECONOMY */}
        <section className="space-y-4 bg-[#0F0F1A] p-6 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-yellow-400">
            <span className="text-3xl">💰</span> 4) ENTRY PASS + COIN RULES
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-bold text-lg text-white">🎟️ Entry Pass (Required)</h3>
              <ul className="space-y-1 text-gray-300 text-sm list-disc pl-5">
                <li>To enter and watch a stream, viewers must pay <strong className="text-yellow-400">300 Troll Coins</strong>.</li>
                <li>The Entry Pass is a one-time payment per broadcaster access window.</li>
                <li>Viewers can leave and rejoin freely without repaying during the active pass.</li>
                <li>All Entry Pass payments are logged.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-lg text-white">💰 Entry Split</h3>
              <ul className="space-y-1 text-gray-300 text-sm list-disc pl-5">
                <li>Each Entry Pass is split automatically:</li>
                <li><span className="text-green-400">✅ 75% (225 coins)</span> → Broadcaster</li>
                <li><span className="text-blue-400">✅ 25% (75 coins)</span> → The Bank (Admin Wallet)</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="font-bold text-lg text-white mb-2">🛡️ Anti-Exploit & Global Wallet</h3>
            <ul className="space-y-2 text-gray-300 list-disc pl-5">
              <li>If a broadcaster ends stream, the viewer’s pass remains valid.</li>
              <li>Viewer will NOT be required to repay for that broadcaster within the pass window.</li>
              <li>Streamers restarting a stream repeatedly to force repays is prohibited.</li>
              <li><strong className="text-white">Global Coin Wallet:</strong> Troll Coins are universal across the entire app.</li>
              <li><strong className="text-red-400">No Coin Purchases in Trolls@Night:</strong> Users cannot buy Troll Coins from Trolls@Night pages. If a user lacks coins, they are redirected to the main Wallet/Coin Store page.</li>
              <li><strong className="text-white">Gifts Still Apply:</strong> Gifts are separate support and can be sent after Entry Pass payment.</li>
            </ul>
          </div>
        </section>

        {/* 5) MODERATION */}
        <section className="space-y-4 bg-[#0F0F1A] p-6 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-indigo-400">
            <span className="text-3xl">👮</span> 5) MODERATION + ENFORCEMENT
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-white mb-2">⚖️ Strike System</h3>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li><span className="text-yellow-400">Strike 1</span> = Warning / short mute</li>
                <li><span className="text-orange-400">Strike 2</span> = Temporary suspension</li>
                <li><span className="text-red-500">Strike 3</span> = Streaming ban / permanent ban</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">🔒 Serious Offenses = Immediate Ban</h3>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li>Doxxing, Hate Speech, Threats of Violence</li>
                <li>Exploit attempts, Explicit Sexual Content</li>
                <li>Illegal Activity</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6) THE BANK */}
        <section className="space-y-4 bg-[#0F0F1A] p-6 rounded-2xl border border-white/10">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-amber-400">
            <span className="text-3xl">🏦</span> 6) THE BANK (ADMIN + LEAD ONLY)
          </h2>
          <p className="text-gray-300">
            The Bank is the app’s total earned Troll Coins across the ENTIRE platform.
            The bank includes Trolls@Night entry fee share, broadcaster activation fees, marketplace/store fees, and other system fees.
          </p>
          <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
            <p className="text-red-200 text-sm">
              <strong className="text-red-400">RESTRICTED:</strong> The Bank page is visible ONLY to Admin and Lead Troll Officers. Regular users cannot view the bank. Any attempt to access Bank routes without permission results in an access error.
            </p>
          </div>
        </section>

        <div className="flex justify-center pt-8">
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition border border-white/20"
          >
            Back
          </button>
        </div>

      </div>
    </div>
  )
}
