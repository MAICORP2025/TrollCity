import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AlertCircle, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { UpdatePayPalSettingsRequest } from '@shared/api';

const Settings = () => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(false);
  const [theme, setTheme] = useState('light');
  const [deviceType, setDeviceType] = useState('desktop');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [paypalEmail, setPaypalEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'stripe' | 'bank'>('paypal');
  const [isUpdatingPayPal, setIsUpdatingPayPal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent;
    if (/android/i.test(userAgent)) {
      setDeviceType('android');
    } else if (/iPad|iPhone|iPod/.test(userAgent)) {
      setDeviceType('ios');
    } else if (/windows/i.test(userAgent)) {
      setDeviceType('windows');
    } else if (/mac/i.test(userAgent)) {
      setDeviceType('mac');
    } else {
      setDeviceType('desktop');
    }

    // Load settings from localStorage
    const savedNotifications = localStorage.getItem(`pwa-notifications-${deviceType}`);
    const savedTheme = localStorage.getItem(`pwa-theme-${deviceType}`);

    if (savedNotifications) setNotifications(JSON.parse(savedNotifications));
    if (savedTheme) setTheme(savedTheme);
  }, [deviceType]);

  useEffect(() => {
    if (user) {
      setPaypalEmail(user.paypal_email || '');
      setPaymentMethod(user.payment_method);
    }
  }, [user]);

  const saveSettings = () => {
    localStorage.setItem(`pwa-notifications-${deviceType}`, JSON.stringify(notifications));
    localStorage.setItem(`pwa-theme-${deviceType}`, theme);
    toast.success('Settings saved for this device!');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to change password');
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to change password';
      setPasswordError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotifications(true);
      }
    }
  };

  const handleUpdatePayPalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPayPal(true);

    try {
      const request: UpdatePayPalSettingsRequest = {
        paypal_email: paymentMethod === 'paypal' ? paypalEmail : undefined,
        payment_method: paymentMethod,
      };

      const response = await fetch('/api/auth/paypal-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update PayPal settings');
      }

      toast.success('PayPal settings updated successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update PayPal settings';
      toast.error(errorMsg);
    } finally {
      setIsUpdatingPayPal(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete account');
      }

      toast.success('Account deleted successfully');
      logout();
      window.location.href = '/';
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete account';
      toast.error(errorMsg);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-6 mb-8">
        <Card className="card-glow">
          <CardHeader>
            <CardTitle>PWA Settings</CardTitle>
            <CardDescription>
              Configure settings for this device ({deviceType}). These settings are stored locally on this device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
              <Label htmlFor="notifications">Enable Notifications</Label>
              <Button onClick={requestNotificationPermission} size="sm">
                Request Permission
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={saveSettings}>Save Settings</Button>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passwordError && (
              <Alert className="mb-4 bg-red-950/50 border-red-500/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">{passwordError}</AlertDescription>
              </Alert>
            )}

            {passwordSuccess && (
              <Alert className="mb-4 bg-green-950/50 border-green-500/50">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-400">Password changed successfully!</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-white">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-white">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isChangingPassword}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isChangingPassword}
                className="w-full neon-btn-gold text-black font-semibold"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle>Payment Settings</CardTitle>
            <CardDescription>
              Configure your PayPal settings for payouts and payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePayPalSettings} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod" className="text-white">
                  Payment Method
                </Label>
                <Select value={paymentMethod} onValueChange={(value: 'paypal' | 'stripe' | 'bank') => setPaymentMethod(value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'paypal' && (
                <div className="space-y-2">
                  <Label htmlFor="paypalEmail" className="text-white">
                    PayPal Email
                  </Label>
                  <Input
                    id="paypalEmail"
                    type="email"
                    placeholder="your-email@example.com"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    disabled={isUpdatingPayPal}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isUpdatingPayPal}
                className="w-full neon-btn-gold text-black font-semibold"
              >
                {isUpdatingPayPal ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Payment Settings'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="card-glow border-red-500/50">
          <CardHeader>
            <CardTitle className="text-red-400">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that will permanently affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data from our servers, including your profile, posts,
                    messages, and coin balance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeletingAccount ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete Account'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;