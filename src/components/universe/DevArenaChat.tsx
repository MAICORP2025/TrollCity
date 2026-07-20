// ============================================================================
// DEV-ONLY PREVIEW — Universe Arena Chat (fake data, no DB/Supabase)
// Self-contained mock chat matching the dev arena aesthetic. Pairs with the
// ActivityFeed in the dev preview right column.
// ============================================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Crown, ShieldAlert, Gift } from "lucide-react";

type DevChatMsg = {
  id: string;
  user: string;
  avatar: string;
  content: string;
  t: number;
  role?: "host" | "mod" | "system" | "user";
  gift?: { name: string; qty: number };
};

const DEV_CHAT_SEED: DevChatMsg[] = [
  { id: "c1", user: "NeonReaper", avatar: "NR", content: "let's run it up team alpha 🔥", t: Date.now() - 42000, role: "host" },
  { id: "c2", user: "VoidTroll", avatar: "VT", content: "GG blue side taking this", t: Date.now() - 31000 },
  { id: "c3", user: "HyperSpecter", avatar: "HS", content: "red never loses, watch", t: Date.now() - 24000, role: "host" },
  { id: "c4", user: "FrostNomad", avatar: "FN", content: "omega on top 💎", t: Date.now() - 17000 },
  { id: "c5", user: "AstroRazor", avatar: "AR", content: "that triple gift was insane", t: Date.now() - 9000 },
  { id: "c6", user: "Mod-Shade", avatar: "MS", content: "keep chat friendly trolls 🛡️", t: Date.now() - 4000, role: "mod" },
];

const DEV_BOTS = [
  { user: "QuantumPhantom", avatar: "QP" },
  { user: "ShadowComet", avatar: "SC" },
  { user: "EmberSpecter", avatar: "ES" },
  { user: "LunarDrifter", avatar: "LD" },
  { user: "VaporBandit", avatar: "VB" },
  { user: "CrimsonWraith", avatar: "CW" },
  { user: "PlasmaBANDIT", avatar: "PB" },
  { user: "ToxicGlitch", avatar: "TG" },
];

const DEV_LINES = [
  "blue side popping off rn",
  "OMEGA COME ON",
  "that score gap is wild",
  "gifting 1k to alpha lets go",
  "who's the host this round?",
  "this arena ui is clean 🔥",
  "red needs a comeback",
  "turtle mode was brutal lol",
  "scramble score got me confused",
  "best battle yet ngl",
  "double time?? unfair 😂",
  "officer fee hurt omega bad",
];

const DEV_GIFTS = [
  { name: "Diamond", qty: 1 },
  { name: "Galaxy", qty: 3 },
  { name: "Troll Crown", qty: 2 },
  { name: "Meteor", qty: 5 },
];

let devChatSeq = 100;
const nextDevId = () => `dev-${devChatSeq++}`;

function badge(role?: string) {
  if (role === "host") return <Crown className="h-3 w-3 text-amber-300" />;
  if (role === "mod") return <ShieldAlert className="h-3 w-3 text-emerald-400" />;
  return null;
}

function nameColor(role?: string) {
  if (role === "host") return "text-amber-300";
  if (role === "mod") return "text-emerald-300";
  return "text-fuchsia-300";
}

export default function DevArenaChat() {
  const [messages, setMessages] = useState<DevChatMsg[]>(() => DEV_CHAT_SEED);
  const [input, setInput] = useState("");
  const [selfName] = useState("You");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const roll = Math.random();
      const bot = DEV_BOTS[Math.floor(Math.random() * DEV_BOTS.length)];
      if (roll < 0.22) {
        const gift = DEV_GIFTS[Math.floor(Math.random() * DEV_GIFTS.length)];
        setMessages((prev) =>
          [...prev, { id: nextDevId(), user: bot.user, avatar: bot.avatar, content: "", t: Date.now(), gift }].slice(-60),
        );
      } else {
        const line = DEV_LINES[Math.floor(Math.random() * DEV_LINES.length)];
        setMessages((prev) =>
          [...prev, { id: nextDevId(), user: bot.user, avatar: bot.avatar, content: line, t: Date.now() }].slice(-60),
        );
      }
    }, 2600);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: nextDevId(), user: selfName, avatar: "YU", content: text, t: Date.now() }].slice(-60));
    setInput("");
  };

  const ordered = useMemo(() => [...messages].sort((a, b) => a.t - b.t), [messages]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">
          <Send className="h-4 w-4 text-fuchsia-300" /> Arena Chat
        </div>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
          LIVE
        </span>
      </div>

      <div ref={scrollRef} className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {ordered.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-2xl border border-white/5 bg-black/30 p-2.5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-[9px] font-black text-slate-300">
                {m.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] font-black ${nameColor(m.role)}`}>{m.user}</span>
                  {badge(m.role)}
                </div>
                {m.gift ? (
                  <div className="mt-0.5 flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
                    <Gift className="h-3.5 w-3.5" />
                    sent {m.gift.name}
                    {m.gift.qty > 1 ? ` x${m.gift.qty}` : ""}
                  </div>
                ) : (
                  <p className="text-[11px] leading-4 text-slate-200">{m.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <form onSubmit={send} className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message…"
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white outline-none placeholder:text-slate-500 focus:border-fuchsia-400/50"
        />
        <button
          type="submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200 transition hover:bg-fuchsia-500/25"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
