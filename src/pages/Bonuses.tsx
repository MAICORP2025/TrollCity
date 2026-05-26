import { Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { NEW_USER_BONUS_PERCENT, COINS_PER_USD, calculateFeeCoins } from '../config/coinConfig'

export default function BonusesPage() {
  const { profile } = useAuthStore()
  const examplePurchase = 1000
  const bonusCoins = Math.floor(examplePurchase * (NEW_USER_BONUS_PERCENT / 100))
  const totalWithBonus = examplePurchase + bonusCoins
  const cashoutExample = 10000
  const cashoutFee = calculateFeeCoins(cashoutExample)

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/80 p-8 shadow-[0_0_40px_rgba(45,212,191,0.12)] backdrop-blur-2xl">
          <h1 className="text-4xl font-black text-white">Bonuses, Coin Rewards & Fees</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Learn how new user bonuses, coin purchase rewards, and platform fees work in Troll City.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-cyan-200">New User Bonus</h2>
            <p className="mt-4 text-slate-300">
              All new users receive a <span className="font-semibold text-white">{NEW_USER_BONUS_PERCENT}%</span> bonus on coin purchases.
            </p>
            <p className="mt-2 text-slate-400">
              Example: buy {examplePurchase.toLocaleString()} coins and get <span className="font-semibold text-white">+{bonusCoins.toLocaleString()}</span> bonus coins, for a total of <span className="font-semibold text-white">{totalWithBonus.toLocaleString()}</span> coins.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-cyan-200">Coin Value</h2>
            <p className="mt-4 text-slate-300">
              Coins are valued at <span className="font-semibold text-white">{COINS_PER_USD} coins = $1.00</span> across the platform.
            </p>
            <p className="mt-2 text-slate-400">
              That means every dollar spent gives you a larger coin balance and the bonus coins are added on top.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-cyan-200">Cashout Fees</h2>
            <p className="mt-4 text-slate-300">
              Cashing out coins carries a platform fee of <span className="font-semibold text-white">5%</span> of the requested coins.
            </p>
            <p className="mt-2 text-slate-400">
              Example: withdrawing {cashoutExample.toLocaleString()} coins uses <span className="font-semibold text-white">{cashoutFee.toLocaleString()}</span> coins as the fee.
            </p>
          </section>
        </div>

        <div className="rounded-[2rem] border border-cyan-500/20 bg-slate-900/90 p-8 shadow-[0_0_32px_rgba(45,212,191,0.14)]">
          <h2 className="text-3xl font-semibold text-white">Other Fees & Agency Charges</h2>
          <ul className="mt-4 space-y-3 text-slate-300">
            <li>
              <span className="font-semibold text-white">Agency startup fee:</span> 25,000 Troll Coins.
            </li>
            <li>
              <span className="font-semibold text-white">Agency monthly subscription fee:</span> 10,000 Troll Coins.
            </li>
            <li>
              <span className="font-semibold text-white">Cashout requests:</span> subject to the 5% coin fee plus any review hold time.
            </li>
            <li>
              <span className="font-semibold text-white">New user purchases:</span> bonus coins are added automatically at checkout for eligible accounts.
            </li>
          </ul>
          <p className="mt-4 text-slate-400">
            These values are platform defaults and are enforced during checkout and approval flows.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg">
          {profile ? (
            <p className="text-slate-300">
              Welcome back, <span className="font-semibold text-white">{profile.display_name || profile.username}</span>. Use the bonuses page to understand how coins and fees affect your balance.
            </p>
          ) : (
            <p className="text-slate-300">Sign in to see your personalized bonus eligibility and rewards.</p>
          )}
          <Link to="/coins" className="inline-flex w-fit rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Buy Coins
          </Link>
        </div>
      </div>
    </div>
  )
}
