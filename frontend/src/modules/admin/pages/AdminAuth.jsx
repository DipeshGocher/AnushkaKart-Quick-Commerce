import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import { Loader2, Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import SignInCard2 from '@/components/ui/sign-in-card-2';

const AdminAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    
    const logoUrl = settings?.logoUrl || '/logo.png';

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        if (!isLogin) {
            const pwd = (formData.password || '').trim();
            if (pwd.length < 10) {
                toast.error('Password must be at least 10 characters long.');
                setIsLoading(false);
                return;
            }
            if (!/[a-z]/.test(pwd)) {
                toast.error('Password must contain at least one lowercase letter.');
                setIsLoading(false);
                return;
            }
            if (!/[A-Z]/.test(pwd)) {
                toast.error('Password must contain at least one uppercase letter.');
                setIsLoading(false);
                return;
            }
            if (!/[0-9]/.test(pwd)) {
                toast.error('Password must contain at least one number.');
                setIsLoading(false);
                return;
            }
        }

        try {
            const response = isLogin
                ? await adminApi.login({ email: formData.email, password: formData.password })
                : await adminApi.signup({ name: formData.name, email: formData.email, password: formData.password });

            const { token, admin } = response.data.result;

            const authData = {
                ...admin,
                token,
                role: 'admin'
            };

            login(authData);

            toast.success(isLogin ? 'Welcome back, Administrator.' : 'Administrator Account Created.');
            navigate('/admin', { replace: true });
        } catch (error) {
            console.error('Login error:', error);
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SignInCard2
            title={isLogin ? 'Welcome Back' : 'Create Admin Account'}
            subtitle={isLogin ? 'Enter your details to manage the platform' : 'Create an administrator account'}
            logoUrl={logoUrl}
            appName="Anushka Store"
        >
            {/* Mode Toggle Tabs */}
            <div className="flex bg-slate-950/80 p-1.5 rounded-2xl mb-6 border border-white/10 relative z-10">
                <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                        isLogin
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                            : "text-slate-400 hover:text-white"
                    }`}
                >
                    Login
                </button>
                <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                        !isLogin
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                            : "text-slate-400 hover:text-white"
                    }`}
                >
                    Sign Up
                </button>
            </div>

            <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
                {!isLogin && (
                    <div>
                        <div className="relative group">
                            <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                name="name"
                                required
                                maxLength={50}
                                pattern="[a-zA-Z\s]*"
                                value={formData.name}
                                onChange={(e) => {
                                    e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                    handleChange(e);
                                }}
                                placeholder="Full Name"
                                className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                            />
                        </div>
                    </div>
                )}

                <div>
                    <div className="relative group">
                        <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Email address"
                            className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        />
                    </div>
                </div>

                <div>
                    <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder={isLogin ? "Password" : "Password (min 10 chars, upper/lower/number)"}
                            className="w-full pl-11 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5" aria-hidden="true" />
                            ) : (
                                <Eye className="h-5 w-5" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-500 hover:from-blue-700 hover:to-orange-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 group"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-slate-400 text-xs font-medium">
                        {isLogin ? "Don't have an admin account? " : "Already have an admin account? "}
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-orange-400 hover:text-orange-300 font-bold transition-colors"
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </form>
        </SignInCard2>
    );
};

export default AdminAuth;
