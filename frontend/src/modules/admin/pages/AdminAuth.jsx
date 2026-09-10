import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import { Loader2, Eye, EyeOff, Mail, Lock, User, ShieldCheck } from 'lucide-react';

const AdminAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    
    // Attempt to use a configured logo, otherwise fallback to the hardcoded default
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

        // Only validate password complexity for signup, not login
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50 px-4 py-8 font-['Outfit']">
            <div className="bg-white text-slate-900 border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto relative overflow-hidden">
                {/* Background Accents */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100/40 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-100/30 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

                {/* Header */}
                <div className="text-center mb-6 relative z-10">
                    <div className="flex flex-col items-center justify-center mb-4">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Admin Portal Logo" className="h-20 sm:h-24 w-auto object-contain" />
                        ) : (
                            <ShieldCheck size={48} className="text-[#E60067]" />
                        )}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                        {isLogin ? 'Welcome Back' : 'Create Admin Account'}
                    </h2>
                    <p className="text-slate-500 text-xs font-medium">
                        {isLogin ? 'Enter your details to manage the platform' : 'Create an administrator account'}
                    </p>
                </div>

                {/* Mode Toggle Tabs */}
                <div className="flex bg-slate-100/90 p-1.5 rounded-2xl mb-6 border border-slate-200/50 relative z-10">
                    <button
                        type="button"
                        onClick={() => setIsLogin(true)}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                            isLogin
                                ? "bg-white text-[#E60067] shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                            !isLogin
                                ? "bg-white text-[#E60067] shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        Sign Up
                    </button>
                </div>

                <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div>
                            <div className="relative group">
                                <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
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
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="relative group">
                            <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Email address"
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="relative group">
                            <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder={isLogin ? "Password" : "Password (min 10 chars, upper/lower/number)"}
                                className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                            className="w-full relative bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                            )}
                        </button>
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-slate-500 text-xs font-medium">
                            {isLogin ? "Don't have an admin account? " : "Already have an admin account? "}
                            <button
                                type="button"
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-[#E60067] hover:text-[#C00052] font-bold transition-colors"
                            >
                                {isLogin ? 'Sign up' : 'Sign in'}
                            </button>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminAuth;
