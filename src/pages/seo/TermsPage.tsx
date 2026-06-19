import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb } from './SEOLayout'
import { FileText, AlertTriangle, Scale, UserCheck, CreditCard, Copyright, Mail } from 'lucide-react'

export default function TermsPage() {
  return (
    <SEOLayout
      title="Terms of Service | Troll City"
      description="Read the Troll City (Mai Troll City) Terms of Service. Understand your rights and responsibilities when using our platform."
      keywords={[
        'Troll City terms of service', 'Mai Troll City terms', 'user agreement',
        'terms and conditions', 'legal', 'Troll City rules', 'platform rules'
      ]}
    >
      <Breadcrumb items={[{ label: 'Terms of Service' }]} />

      <section className="relative py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <FileText className="w-4 h-4" />
              Legal
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Terms of{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Service
              </span>
            </h1>

            <p className="text-slate-400">Last updated: January 1, 2026</p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <p className="text-slate-300 leading-relaxed">
                These Terms of Service ("Terms") govern your use of Troll City ("the Platform"). By accessing or using
                our Platform, you agree to be bound by these Terms. If you do not agree, please do not use the Platform.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <UserCheck className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">Account Registration</h2>
              </div>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>You must be at least 13 years old to create an account.</li>
                <li>You must provide accurate and complete information during registration.</li>
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>You are responsible for all activity that occurs under your account.</li>
                <li>One account per person is allowed. Multiple accounts may result in suspension.</li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">Acceptable Use</h2>
              </div>
              <p className="text-slate-300 mb-3">You agree NOT to:</p>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>Harass, bully, threaten, or intimidate other users</li>
                <li>Post or share explicit, violent, or illegal content</li>
                <li>Impersonate another person or entity</li>
                <li>Spam, scam, or deceive other users</li>
                <li>Attempt to gain unauthorized access to other accounts or systems</li>
                <li>Use automated tools, bots, or scripts to interact with the Platform</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Distribute malware or harmful code</li>
                <li>Engage in hate speech or discrimination</li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Copyright className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">Content & Intellectual Property</h2>
              </div>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>You retain ownership of the content you create and share on Troll City.</li>
                <li>By posting content, you grant Troll City a license to display, distribute, and promote your content on the Platform.</li>
                <li>You may not upload content that infringes on others' intellectual property rights.</li>
                <li>Troll City's trademarks, logos, and branding may not be used without permission.</li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">Virtual Currency & Payments</h2>
              </div>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>Troll Coins are virtual currency with no real-world value outside the Platform.</li>
                <li>All purchases are final. Refunds are subject to our Refund Policy.</li>
                <li>Creator earnings are subject to verification and minimum payout thresholds.</li>
                <li>Troll City reserves the right to modify pricing and virtual currency values.</li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">Enforcement & Termination</h2>
              </div>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>Violations may result in warnings, temporary suspensions, or permanent bans.</li>
                <li>Serious violations may result in immediate account termination without prior notice.</li>
                <li>You may appeal enforcement decisions through our court system.</li>
                <li>Troll City reserves the right to terminate accounts at its discretion.</li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">Disclaimer of Warranties</h2>
              <p className="text-slate-300">
                The Platform is provided "as is" without warranties of any kind. We do not guarantee uninterrupted
                service, error-free operation, or specific results from using the Platform.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">Limitation of Liability</h2>
              <p className="text-slate-300">
                Troll City shall not be liable for any indirect, incidental, special, or consequential damages
                arising from your use of the Platform.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">Changes to These Terms</h2>
              <p className="text-slate-300">
                We may update these Terms from time to time. Continued use of the Platform after changes constitutes
                acceptance of the new Terms.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">Contact</h2>
              </div>
              <p className="text-slate-300">
                For questions about these Terms, contact us at{' '}
                <a href="mailto:legal@maitrollcity.com" className="text-purple-400 hover:text-purple-300">
                  legal@maitrollcity.com
                </a>{' '}
                or visit our <Link to="/contact" className="text-purple-400 hover:text-purple-300">Contact page</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </SEOLayout>
  )
}
