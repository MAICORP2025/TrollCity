import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import {
  Star, Upload, Coins, Wallet, Check,
  Shield, Copyright, MessageSquare, ChevronRight,
  Loader2, AlertCircle, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function BecomeCreator() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState(null);

  const [formData, setFormData] = useState({
    full_name: '',
    channel_name: '',
    content_description: '',
    agreed_to_safety_policy: false,
    agreed_to_copyright_policy: false,
    agreed_to_speech_policy: false,
    agreed_to_terms: false,
  });

  const loadUser = async () => {
    try {
      const userData = await supabase.auth.me();
      setUser(userData);
      setFormData(prev => ({
        ...prev,
        full_name: userData.full_name || ''
      }));

      // Check for existing application
      const applications = await supabase.entities.CreatorApplication.filter({
        user_email: userData.email
      });
      if (applications.length > 0) {
        setExistingApplication(applications[0]);
      }
    } catch {
      setUser(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadUser();
    };
    fetchUser();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to apply');
      supabase.auth.redirectToLogin();
      return;
    }

    if (!formData.channel_name) {
      toast.error('Please enter a channel name');
      return;
    }

    if (!formData.agreed_to_safety_policy || !formData.agreed_to_copyright_policy || 
        !formData.agreed_to_speech_policy || !formData.agreed_to_terms) {
      toast.error('Please agree to all policies');
      return;
    }

    setIsSubmitting(true);

    try {
      await supabase.entities.CreatorApplication.create({
        user_email: user.email,
        ...formData,
        status: 'pending'
      });

      toast.success('Application submitted! We will review it shortly.');
      loadUser();
    } catch {
      toast.error('Failed to submit application');
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already a creator
  if (user?.is_creator) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">You're Already a Creator!</h1>
          <p className="text-gray-400 mb-8">Start uploading content and earning MAI Coins.</p>
          <div className="flex gap-4 justify-center">
            <Link to={createPageUrl('Upload')}>
              <Button className="neon-btn-red text-white">
                <Upload className="w-4 h-4 mr-2" />
                Upload Content
              </Button>
            </Link>
            <Link to={createPageUrl('CreatorDashboard')}>
              <Button variant="outline" className="border-[#FFD700] text-[#FFD700]">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Has pending/rejected application
  if (existingApplication) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          {existingApplication.status === 'pending' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Application Under Review</h1>
              <p className="text-gray-400 mb-8">
                Your creator application is being reviewed. We'll notify you once it's approved.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Application Rejected</h1>
              <p className="text-gray-400 mb-4">
                Unfortunately, your application was not approved.
              </p>
              {existingApplication.rejection_reason && (
                <p className="text-red-400 text-sm mb-8">
                  Reason: {existingApplication.rejection_reason}
                </p>
              )}
            </>
          )}
          <Link to={createPageUrl('Home')}>
            <Button variant="outline" className="border-gray-700 text-gray-400">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/30 mb-6">
            <Star className="w-4 h-4 text-[#FF1744]" />
            <span className="text-[#FF1744] text-sm font-medium">Creator Program</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Become a <span className="neon-red">Creator</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Share your content with the world and earn MAI Coins from your audience
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Upload className="w-10 h-10 text-[#FFD700] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Upload Content</h3>
            <p className="text-sm text-gray-400">Share shorts and movies with millions of viewers</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Coins className="w-10 h-10 text-[#FFD700] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Earn Coins</h3>
            <p className="text-sm text-gray-400">Get paid when viewers unlock your premium content</p>
          </div>
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Wallet className="w-10 h-10 text-[#FFD700] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Cash Out</h3>
            <p className="text-sm text-gray-400">Convert coins to real money via PayPal</p>
          </div>
        </div>

        {/* Application Form */}
        <div className="rounded-2xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/5 to-transparent p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Creator Application</h2>
          
          {!user ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Please sign in to apply</p>
              <Button 
                onClick={() => supabase.auth.redirectToLogin()}
                className="neon-btn-gold text-black"
              >
                Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-400">Full Name</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="mt-2 bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-400">Channel Name *</Label>
                  <Input
                    value={formData.channel_name}
                    onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                    placeholder="Your creator name"
                    className="mt-2 bg-gray-900 border-gray-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-400">What type of content will you create?</Label>
                <Textarea
                  value={formData.content_description}
                  onChange={(e) => setFormData({ ...formData, content_description: e.target.value })}
                  placeholder="Describe your content plans..."
                  className="mt-2 bg-gray-900 border-gray-700 text-white h-24"
                />
              </div>

              {/* Policies */}
              <div className="space-y-4 p-6 rounded-xl bg-black/30 border border-gray-800">
                <h3 className="font-semibold text-white mb-4">Agree to Platform Policies</h3>
                
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="safety"
                    checked={formData.agreed_to_safety_policy}
                    onCheckedChange={(checked) => setFormData({ ...formData, agreed_to_safety_policy: checked })}
                  />
                  <div>
                    <label htmlFor="safety" className="text-sm text-white cursor-pointer flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#FFD700]" />
                      Safety & Usage Policy
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      I agree to maintain safe content and follow community guidelines
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="copyright"
                    checked={formData.agreed_to_copyright_policy}
                    onCheckedChange={(checked) => setFormData({ ...formData, agreed_to_copyright_policy: checked })}
                  />
                  <div>
                    <label htmlFor="copyright" className="text-sm text-white cursor-pointer flex items-center gap-2">
                      <Copyright className="w-4 h-4 text-[#FFD700]" />
                      Copyright Policy
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      I agree to only upload content I own or have rights to use
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="speech"
                    checked={formData.agreed_to_speech_policy}
                    onCheckedChange={(checked) => setFormData({ ...formData, agreed_to_speech_policy: checked })}
                  />
                  <div>
                    <label htmlFor="speech" className="text-sm text-white cursor-pointer flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#FFD700]" />
                      Freedom of Speech Policy
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Weapons may be showcased but sales are strictly prohibited and will result in account termination
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={formData.agreed_to_terms}
                    onCheckedChange={(checked) => setFormData({ ...formData, agreed_to_terms: checked })}
                  />
                  <div>
                    <label htmlFor="terms" className="text-sm text-white cursor-pointer">
                      Terms of Use
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      I agree to the{' '}
                      <Link to={createPageUrl('TermsAgreement')} className="text-[#FFD700] hover:underline">
                        Terms of Use
                      </Link>
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full neon-btn-red text-white py-6 text-lg font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Application
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}