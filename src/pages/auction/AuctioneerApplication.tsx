import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Gavel, Send, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

interface ApplicationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const AuctioneerApplication: React.FC<ApplicationFormProps> = ({ onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  
  const [formData, setFormData] = useState({
    displayName: profile?.display_name || profile?.full_name || '',
    applicationText: '',
    sellingPlan: '',
    experience: '',
    agreementAccepted: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to apply');
      return;
    }

    if (!formData.agreementAccepted) {
      toast.error('You must agree to the auctioneer rules and terms');
      return;
    }

    if (!formData.displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    if (!formData.applicationText.trim()) {
      toast.error('Please tell us why you want to be an auctioneer');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('submit_auctioneer_application', {
        p_display_name: formData.displayName,
        p_application_text: formData.applicationText,
        p_agreement_accepted: formData.agreementAccepted,
        p_selling_plan: formData.sellingPlan || null,
        p_experience: formData.experience || null
      });

      if (rpcError) throw rpcError;

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (result.success) {
        toast.success('Application submitted successfully!');
        onSuccess?.();
      } else {
        setError(result.error || 'Failed to submit application');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-green-500/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 border-b border-green-500/20 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Gavel className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Auctioneer Application</h2>
                <p className="text-xs text-gray-400">Apply to host live auctions</p>
              </div>
            </div>
            {onCancel && (
              <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Display Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="How you want to be known as an auctioneer"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Why do you want to be an auctioneer */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Why do you want to be an auctioneer? <span className="text-red-400">*</span>
            </label>
            <textarea
              value={formData.applicationText}
              onChange={(e) => setFormData({ ...formData, applicationText: e.target.value })}
              placeholder="Tell us about your interest in hosting live auctions..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>

          {/* What do you plan to sell */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              What do you plan to sell?
            </label>
            <textarea
              value={formData.sellingPlan}
              onChange={(e) => setFormData({ ...formData, sellingPlan: e.target.value })}
              placeholder="Describe the types of items you plan to auction..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Experience (optional)
            </label>
            <textarea
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              placeholder="Any relevant experience with auctions, sales, or hosting..."
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Agreement */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.agreementAccepted}
                onChange={(e) => setFormData({ ...formData, agreementAccepted: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500 bg-gray-700"
              />
              <span className="text-sm text-gray-300">
                I agree to follow all auctioneer rules and terms. I understand that I must maintain good standing in the community and that my auctioneer privileges can be suspended for violations.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Application
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuctioneerApplication;