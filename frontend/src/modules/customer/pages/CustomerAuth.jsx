import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { customerApi } from '../services/customerApi';
import { toast } from 'sonner';
import { ArrowRight, ShoppingBag, Phone, User, CheckCircle2 } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import SignInCard2 from '@/components/ui/sign-in-card-2';

const CustomerAuth = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { settings } = useSettings();
    const { t } = useTranslation();

    const fromState = location.state?.from;
    const fromPath = typeof fromState === 'string'
        ? fromState
        : (fromState?.pathname ? (fromState.pathname + (fromState.search || '')) : null);

    const isProtectedRoute = (path) => {
        if (!path) return false;
        const cleanPath = path.split('?')[0];
        const protectedPaths = [
            '/cart', '/wishlist', '/orders', '/transactions', '/addresses',
            '/settings', '/help', '/chat', '/checkout', '/profile', '/wallet',
            '/notifications'
        ];
        return protectedPaths.some(p => cleanPath === p || cleanPath.startsWith(p + '/'));
    };

    const handleClose = () => {
        if (fromPath && !isProtectedRoute(fromPath) && fromPath !== '/login' && fromPath !== '/signup' && fromPath !== '/verify-otp') {
            navigate(fromPath, { replace: true });
            return;
        }

        navigate('/', { replace: true });
    };

    const isSignupRoute = location.pathname.includes('/signup');
    const [isLogin, setIsLogin] = useState(() => {
        if (location.state?.isLogin !== undefined) {
            return location.state.isLogin;
        }
        return !isSignupRoute;
    });

    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: location.state?.name || '',
        phone: location.state?.phone || '',
    });

    useEffect(() => {
        if (location.state?.isLogin !== undefined) {
            setIsLogin(location.state.isLogin);
        } else {
            setIsLogin(!location.pathname.includes('/signup'));
        }
    }, [location.pathname, location.state]);

    const handleToggleMode = () => {
        const nextMode = !isLogin;
        setIsLogin(nextMode);
        navigate(nextMode ? '/login' : '/signup', {
            state: { ...location.state, isLogin: nextMode, name: formData.name, phone: formData.phone },
            replace: true
        });
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!formData.phone || formData.phone.length !== 10) {
            toast.error(t('enterValidPhone') || 'Enter valid 10-digit number');
            return;
        }

        if (!isLogin && !formData.name.trim()) {
            toast.error(t('enterFullName') || 'Please enter your full name');
            return;
        }

        setIsLoading(true);
        try {
            if (isLogin) {
                await customerApi.sendLoginOtp({ phone: formData.phone });
            } else {
                await customerApi.sendSignupOtp({
                    name: formData.name.trim(),
                    phone: formData.phone,
                });
            }
            toast.success(t('otpSentSuccess') || 'OTP sent successfully!');

            // Store in sessionStorage as fallback for page reload
            sessionStorage.setItem('anushka_pending_auth', JSON.stringify({
                phone: formData.phone,
                name: formData.name.trim(),
                isLogin,
                from: fromPath
            }));

            // Navigate to dedicated /verify-otp route
            navigate('/verify-otp', {
                state: {
                    phone: formData.phone,
                    name: formData.name.trim(),
                    isLogin,
                    from: fromPath
                }
            });
        } catch (error) {
            const apiMessage = error?.response?.data?.message;
            toast.error(apiMessage || t('otpSendFailed') || 'Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SignInCard2
            containerClassName="customer-app"
            onBack={handleClose}
            icon={ShoppingBag}
            iconBg="bg-gradient-to-br from-[#7777FF] to-[#6666FF] text-white"
            iconColor="text-white"
            title={isLogin ? 'Welcome Back' : 'Create Account'}
            subtitle={isLogin ? 'Login to access your orders & deliveries' : 'Enter your details to get started'}
            logoUrl={settings?.logoUrl || "/logo.png"}
            appName="Anushka Store"
            bgImageUrl="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1920&q=80"
            footer={
                <p className="text-xs font-semibold text-slate-500">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                        type="button"
                        onClick={handleToggleMode}
                        className="text-[#6666FF] font-bold hover:underline transition-colors ml-0.5 cursor-pointer"
                    >
                        {isLogin ? 'Register' : 'Login'}
                    </button>
                </p>
            }
        >
            <form className="space-y-4" onSubmit={handleSendOtp}>
                {!isLogin && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold tracking-wider text-[#0F172A] uppercase mb-1.5 px-0.5">
                                FULL NAME
                            </label>
                            <div className="relative flex items-center border border-slate-200 rounded-2xl overflow-hidden transition-all bg-slate-50 focus-within:bg-white focus-within:border-[#6666FF] focus-within:ring-2 focus-within:ring-[#6666FF]/20">
                                <div className="pl-4 pr-2 text-slate-400 shrink-0">
                                    <User className="w-4 h-4 text-[#6666FF]" />
                                </div>
                                <input
                                    required
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    placeholder="Enter Full Name"
                                    className="customer-auth-bare-input w-full px-3 py-3.5 text-sm font-semibold text-[#0F172A] outline-none bg-transparent placeholder:text-slate-400 !border-0 !shadow-none !ring-0"
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-[11px] font-bold tracking-wider text-[#0F172A] uppercase mb-1.5 px-0.5">
                        PHONE NUMBER
                    </label>
                    <div className={`relative flex items-center border rounded-2xl overflow-hidden transition-all bg-slate-50 focus-within:bg-white ${
                        formData.phone.length === 10
                            ? 'border-emerald-500/80 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20'
                            : 'border-slate-200 focus-within:border-[#6666FF] focus-within:ring-2 focus-within:ring-[#6666FF]/20'
                    }`}>
                        <div className="pl-4 pr-3 py-3.5 flex items-center gap-1.5 font-bold text-slate-700 text-sm border-r border-slate-200/80 bg-slate-100/60 shrink-0">
                            <Phone className="w-4 h-4 text-[#6666FF]" />
                            <span>+91</span>
                        </div>
                        <input
                            required
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="tel"
                            name="phone"
                            value={formData.phone}
                            maxLength={10}
                            placeholder="Enter Phone Number"
                            className="customer-auth-bare-input w-full px-4 py-3.5 text-sm font-bold text-[#0F172A] outline-none bg-transparent placeholder:text-slate-400 !border-0 !shadow-none !ring-0"
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                        />
                    </div>
                    {formData.phone ? (
                        <div className="mt-1.5 px-1 text-xs font-semibold">
                            {formData.phone.length === 10 ? (
                                <span className="text-emerald-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Standard 10-digit Mobile Number
                                </span>
                            ) : (
                                <span className="text-slate-400 text-[11px] font-medium">
                                    Enter 10-digit mobile number ({formData.phone.length}/10)
                                </span>
                            )}
                        </div>
                    ) : null}
                </div>

                <button
                    type="submit"
                    disabled={isLoading || formData.phone.length !== 10 || (!isLogin && !formData.name.trim())}
                    className="w-full mt-3 relative bg-gradient-to-r from-[#7777FF] via-[#6666FF] to-[#5555EE] hover:from-[#6666FF] hover:to-[#4F4FDD] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-[#6666FF]/25 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <span>{isLogin ? 'Login Now' : 'Register Now'}</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </form>
        </SignInCard2>
    );
};

export default CustomerAuth;
