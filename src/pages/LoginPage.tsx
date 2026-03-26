import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Shield, BookOpen, Users, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function dashboardPathForRole(role: UserRole | null): string | null {
  if (!role) return null;
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/instructor';
  return '/student';
}

const roles: { value: UserRole; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'admin', label: 'Admin', icon: Shield, desc: 'Manage the platform' },
  { value: 'instructor', label: 'Instructor', icon: BookOpen, desc: 'Teach & manage courses' },
  { value: 'student', label: 'Student', icon: Users, desc: 'Learn & grow' },
];

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName, selectedRole);
        toast({ title: 'Account created!', description: 'Please check your email to verify your account.' });
      } else {
        const role = await signIn(email, password);
        const path = dashboardPathForRole(role);
        if (!path) {
          toast({
            title: 'Sign in failed',
            description: 'Could not load your profile. Try again or contact support.',
            variant: 'destructive',
          });
          return;
        }
        navigate(path, { replace: true });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-secondary rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center max-w-lg">
          <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-8">
            <GraduationCap className="w-8 h-8 text-accent-foreground" />
          </div>
          <h1 className="font-display font-bold text-4xl text-primary-foreground mb-4">
            Welcome to Bloomy Technologies
          </h1>
          <p className="text-primary-foreground/70 text-lg">
            Lagos' premier tech training institute. Access your courses, track progress, and connect with your learning community.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-lg gradient-accent flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">BloomyTech</span>
          </div>

          <h2 className="font-display font-bold text-2xl text-foreground mb-2">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-muted-foreground mb-8">
            {isSignUp ? 'Join Bloomy Technologies today' : 'Sign in to continue learning'}
          </p>

          {/* Role Selector — only shown during sign up */}
          {isSignUp && (
            <div className="mb-6">
              <Label className="text-sm font-medium text-foreground mb-3 block">Select your role</Label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                      selectedRole === r.value
                        ? 'border-secondary bg-secondary/10 shadow-accent'
                        : 'border-border bg-card hover:border-muted-foreground/30'
                    }`}
                  >
                    <r.icon className={`w-5 h-5 mx-auto mb-1 ${selectedRole === r.value ? 'text-secondary' : 'text-muted-foreground'}`} />
                    <div className={`text-xs font-semibold font-display ${selectedRole === r.value ? 'text-secondary' : 'text-foreground'}`}>{r.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-secondary font-semibold hover:underline">
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>

          <Link to="/" className="block text-center text-sm text-muted-foreground mt-4 hover:text-foreground">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
