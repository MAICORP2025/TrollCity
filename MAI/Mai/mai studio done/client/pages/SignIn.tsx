import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SignIn() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMsg);
    }
  };



  return (
    <Layout>
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="card-glow rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">
              Sign In
            </h1>
            <p className="text-gray-400 text-center mb-8">
              Welcome back to MAI Studios
            </p>

            {error && (
              <Alert className="mb-6 bg-red-950/50 border-red-500/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full neon-btn-gold text-black font-semibold h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center">
                <Link
                  to="/reset-password"
                  className="text-yellow-400 hover:text-yellow-300 font-semibold transition text-sm"
                >
                  Forgot Password?
                </Link>
              </div>
            </form>

            <div className="mt-8 pt-8 border-t border-white/10">
              <p className="text-gray-400 text-center">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="text-yellow-400 hover:text-yellow-300 font-semibold transition"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
