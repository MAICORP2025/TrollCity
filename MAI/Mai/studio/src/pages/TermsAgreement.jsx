import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { 
  Sparkles, Shield, Copyright, MessageSquare, 
  AlertTriangle, Check, ChevronDown, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';

export default function TermsAgreement() {
  const [user, setUser] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  const loadUser = async () => {
    try {
      const userData = await supabase.auth.me();
      setUser(userData);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadUser();
    };
    fetchUser();
  }, []);

  const handleAgree = async () => {
    if (!user) {
      toast.error('Please sign in to continue');
      supabase.auth.redirectToLogin();
      return;
    }

    if (!agreed) {
      toast.error('Please agree to the terms');
      return;
    }

    setIsSubmitting(true);

    try {
      await supabase.auth.updateMe({
        agreed_to_terms: true,
        terms_agreed_date: new Date().toISOString()
      });
      toast.success('Thank you for agreeing to our terms!');
      window.location.href = createPageUrl('Home');
    } catch {
      toast.error('Failed to save. Please try again.');
    }

    setIsSubmitting(false);
  };

  const sections = [
    {
      id: 'safety',
      icon: Shield,
      title: 'Safety & Usage Policy',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      content: `
        <h4>Community Safety Guidelines</h4>
        <ul>
          <li>Content must not promote violence, harassment, or hate speech</li>
          <li>No sexually explicit or pornographic material</li>
          <li>Content depicting dangerous or harmful activities must include appropriate warnings</li>
          <li>No content targeting or exploiting minors</li>
          <li>Users must be 18 years or older to use the platform</li>
        </ul>
        <h4>Account Responsibility</h4>
        <ul>
          <li>You are responsible for all activity under your account</li>
          <li>Do not share your account credentials</li>
          <li>Report suspicious activity immediately</li>
        </ul>
      `
    },
    {
      id: 'copyright',
      icon: Copyright,
      title: 'Copyright Policy',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      content: `
        <h4>Original Content</h4>
        <ul>
          <li>Only upload content you have created or have explicit permission to use</li>
          <li>Do not use copyrighted music, videos, or images without proper licensing</li>
          <li>Provide proper attribution when required</li>
        </ul>
        <h4>DMCA Compliance</h4>
        <ul>
          <li>MAI Studios complies with the Digital Millennium Copyright Act</li>
          <li>Copyright holders may submit takedown requests</li>
          <li>Repeat infringers will have their accounts terminated</li>
          <li>False copyright claims may result in legal action</li>
        </ul>
      `
    },
    {
      id: 'speech',
      icon: MessageSquare,
      title: 'Freedom of Speech Policy',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      content: `
        <h4>Expression Guidelines</h4>
        <ul>
          <li>MAI Studios supports freedom of expression within legal boundaries</li>
          <li>Political content and opinions are permitted</li>
          <li>Educational content about sensitive topics is allowed with proper context</li>
        </ul>
        <h4>Weapons Policy</h4>
        <ul>
          <li><strong>ALLOWED:</strong> Display, discussion, or educational content about weapons</li>
          <li><strong>ALLOWED:</strong> Sporting, hunting, or historical content featuring weapons</li>
          <li><strong class="text-red-400">PROHIBITED:</strong> Sale, trade, or facilitation of weapon transactions</li>
          <li><strong class="text-red-400">PROHIBITED:</strong> Instructions for creating illegal weapons</li>
        </ul>
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-4">
          <p class="text-red-400 font-semibold">⚠️ ZERO TOLERANCE WARNING</p>
          <p class="text-gray-400 text-sm mt-2">Any attempt to sell, trade, or facilitate the sale of weapons through MAI Studios will result in immediate and permanent account termination, forfeiture of all MAI Coins, and potential reporting to law enforcement authorities.</p>
        </div>
      `
    },
    {
      id: 'coins',
      icon: Sparkles,
      title: 'MAI Coins Terms',
      color: 'text-[#FFD700]',
      bgColor: 'bg-[#FFD700]/10',
      borderColor: 'border-[#FFD700]/30',
      content: `
        <h4>Coin Purchases</h4>
        <ul>
          <li>MAI Coins are a virtual currency for use within MAI Studios only</li>
          <li>All purchases are final and non-refundable</li>
          <li>Coins have no cash value outside the platform</li>
        </ul>
        <h4>Creator Payouts</h4>
        <ul>
          <li>Creators can cash out coins at designated tiers</li>
          <li>Payouts are processed on Mondays and Fridays</li>
          <li>A valid PayPal account is required for payouts</li>
          <li>MAI Studios reserves the right to verify identity before processing large payouts</li>
          <li>Fraudulent activity will result in forfeiture of coins and account termination</li>
        </ul>
      `
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#FFD700]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#FF1744]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 mb-6"
          >
            <Sparkles className="w-8 h-8 text-[#FFD700]" />
            <span className="text-3xl font-bold neon-gold">MAI Studios</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Terms of <span className="neon-red">Use</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-400 max-w-xl mx-auto"
          >
            Please review and agree to our platform policies before continuing
          </motion.p>
        </div>

        {/* Policy Sections */}
        <div className="space-y-4 mb-12">
          {sections.map((section, index) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className={`w-full p-6 rounded-2xl border ${section.borderColor} ${section.bgColor} hover:bg-opacity-20 transition-all`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${section.bgColor}`}>
                      <section.icon className={`w-6 h-6 ${section.color}`} />
                    </div>
                    <span className="text-lg font-semibold text-white">{section.title}</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expandedSection === section.id ? 'rotate-180' : ''}`} />
                </div>
              </button>
              
              <AnimatePresence>
                {expandedSection === section.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div 
                      className="p-6 text-gray-300 text-sm leading-relaxed policy-content"
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Agreement Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-[#FF1744]/5 p-8"
        >
          <div className="flex items-start gap-4 mb-6">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={setAgreed}
              className="mt-1"
            />
            <label htmlFor="agree" className="text-gray-300 cursor-pointer">
              I have read and agree to the <span className="text-[#FFD700]">Safety Policy</span>, <span className="text-[#FFD700]">Copyright Policy</span>, <span className="text-[#FFD700]">Freedom of Speech Policy</span>, and <span className="text-[#FFD700]">MAI Coins Terms</span>. I understand that violation of these terms may result in account termination.
            </label>
          </div>

          {user ? (
            <Button
              onClick={handleAgree}
              disabled={!agreed || isSubmitting}
              className="w-full neon-btn-gold text-black py-6 text-lg font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  I Agree to Terms
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => supabase.auth.redirectToLogin()}
              className="w-full neon-btn-gold text-black py-6 text-lg font-semibold"
            >
              Sign In to Continue
            </Button>
          )}
        </motion.div>

        {/* Footer Link */}
        <div className="text-center mt-8">
          <Link to={createPageUrl('Home')} className="text-gray-500 hover:text-[#FFD700] transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      <style>{`
        .policy-content h4 {
          color: white;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .policy-content h4:first-child {
          margin-top: 0;
        }
        .policy-content ul {
          list-style: disc;
          padding-left: 1.5rem;
        }
        .policy-content li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
}