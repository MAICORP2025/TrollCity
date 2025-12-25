import React, { useState } from 'react';
import {
  Shield, Copyright, MessageSquare, Coins,
  AlertTriangle, Check, X, Sparkles
} from 'lucide-react';

export default function Policies() {
  const [activeSection, setActiveSection] = useState('safety');

  const sections = [
    {
      id: 'safety',
      icon: Shield,
      title: 'Safety & Usage Policy',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    {
      id: 'copyright',
      icon: Copyright,
      title: 'Copyright Policy',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      id: 'speech',
      icon: MessageSquare,
      title: 'Freedom of Speech',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      id: 'coins',
      icon: Coins,
      title: 'MAI Coins & Payments',
      color: 'text-[#FFD700]',
      bgColor: 'bg-[#FFD700]/10',
      borderColor: 'border-[#FFD700]/30',
    },
  ];

  const content = {
    safety: (
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Community Safety Guidelines</h3>
          <p className="text-gray-400 mb-4">
            MAI Studios is committed to providing a safe environment for all users. The following content is strictly prohibited:
          </p>
          <div className="space-y-3">
            {[
              'Content promoting violence, harassment, or hate speech against individuals or groups',
              'Sexually explicit, pornographic, or obscene material',
              'Content depicting dangerous activities without proper warnings',
              'Content exploiting, endangering, or sexualizing minors',
              'Spam, scams, or misleading content',
              'Personal information of others without consent (doxxing)',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4">Account Responsibility</h3>
          <div className="space-y-3">
            {[
              'You are responsible for all activity under your account',
              'Keep your login credentials secure and do not share them',
              'Report any suspicious activity or security breaches immediately',
              'Users must be 18 years or older to use MAI Studios',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-400">Violations & Enforcement</p>
              <p className="text-sm text-gray-400 mt-1">
                Violations may result in content removal, account suspension, or permanent termination depending on severity. Repeat offenders will be permanently banned.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
    copyright: (
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Original Content Requirements</h3>
          <p className="text-gray-400 mb-4">
            MAI Studios respects intellectual property rights. All uploaded content must comply with copyright laws.
          </p>
          <div className="space-y-3">
            {[
              'Only upload content you have created yourself',
              'Have explicit written permission from the copyright holder',
              'Use properly licensed music, images, and video clips',
              'Provide appropriate attribution when required',
              'Understand fair use limitations and guidelines',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <Check className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4">DMCA Compliance</h3>
          <p className="text-gray-400 mb-4">
            MAI Studios complies with the Digital Millennium Copyright Act (DMCA):
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2">
            <li>Copyright holders may submit takedown requests via our support channels</li>
            <li>Infringing content will be removed within 48 hours of valid notices</li>
            <li>Counter-notifications can be filed if you believe content was wrongly removed</li>
            <li>Repeat infringers (3+ valid claims) will have accounts terminated</li>
          </ul>
        </div>
      </div>
    ),
    speech: (
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Freedom of Expression</h3>
          <p className="text-gray-400 mb-4">
            MAI Studios supports freedom of expression within legal and ethical boundaries:
          </p>
          <div className="space-y-3">
            {[
              'Political opinions and commentary are welcome',
              'Educational content on sensitive topics is allowed with proper context',
              'Artistic expression including mature themes (with age restrictions)',
              'Documentary and journalistic content',
              'Critical reviews and commentary',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <Check className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4">Weapons Policy</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <p className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                <Check className="w-5 h-5" /> Allowed
              </p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Display and discussion of weapons</li>
                <li>• Educational and historical content</li>
                <li>• Sporting and hunting content</li>
                <li>• Reviews and demonstrations</li>
                <li>• Entertainment (movies, games)</li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                <X className="w-5 h-5" /> Prohibited
              </p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Sale or trade of any weapons</li>
                <li>• Facilitating weapon transactions</li>
                <li>• Links to weapon sales sites</li>
                <li>• Instructions for illegal weapons</li>
                <li>• Promoting illegal weapon modifications</li>
              </ul>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-red-500/10 border-2 border-red-500/50">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-xl font-bold text-red-400 mb-2">ZERO TOLERANCE POLICY</p>
                <p className="text-gray-300">
                  Any attempt to sell, trade, or facilitate the sale of weapons through MAI Studios will result in:
                </p>
                <ul className="text-gray-400 mt-2 space-y-1">
                  <li>• Immediate and permanent account termination</li>
                  <li>• Complete forfeiture of all MAI Coins</li>
                  <li>• Potential reporting to law enforcement authorities</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    coins: (
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">MAI Coins Overview</h3>
          <p className="text-gray-400 mb-4">
            MAI Coins are the virtual currency used within MAI Studios for purchasing premium content and supporting creators.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
              <h4 className="font-semibold text-white mb-3">Coin Packages</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>1,000 Coins</span><span className="text-[#FFD700]">$4.49</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>5,000 Coins</span><span className="text-[#FFD700]">$20.99</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>12,000 Coins</span><span className="text-[#FFD700]">$49.99</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>25,000 Coins</span><span className="text-[#FFD700]">$99.99</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>60,000 Coins</span><span className="text-[#FFD700]">$239.99</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>120,000 Coins</span><span className="text-[#FFD700]">$459.99</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
              <h4 className="font-semibold text-white mb-3">Cash-Out Tiers</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>12,000 Coins</span><span className="text-green-400">$25</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>30,000 Coins</span><span className="text-green-400">$70</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>60,000 Coins</span><span className="text-green-400">$150</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>120,000 Coins</span><span className="text-green-400">$325</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>250,000 Coins</span><span className="text-green-400">$700</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4">Important Terms</h3>
          <div className="space-y-3">
            {[
              'All coin purchases are final and non-refundable',
              'Coins have no cash value outside MAI Studios',
              'Payouts are processed on Mondays and Fridays',
              'Valid PayPal account required for creator payouts',
              'MAI Studios may verify identity for large payouts',
              'Fraudulent activity results in forfeiture of all coins',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#FFD700]/5 border border-[#FFD700]/20">
                <Coins className="w-4 h-4 text-[#FFD700] mt-0.5 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-6">
            <Sparkles className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium">Platform Policies</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            MAI Studios <span className="neon-gold">Policies</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Understanding our community guidelines and terms of service
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                    activeSection === section.id
                      ? `${section.bgColor} ${section.borderColor} border`
                      : 'hover:bg-gray-900/50'
                  }`}
                >
                  <section.icon className={`w-5 h-5 ${activeSection === section.id ? section.color : 'text-gray-500'}`} />
                  <span className={activeSection === section.id ? 'text-white font-medium' : 'text-gray-400'}>
                    {section.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-gray-800 bg-gray-900/30 p-8"
            >
              {content[activeSection]}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}