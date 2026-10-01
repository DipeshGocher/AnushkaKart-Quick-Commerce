import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../services/customerApi';
import { invalidateCache } from '@core/api/dedupe';
import { toast } from 'sonner';
import { ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import SignInCard2 from '@/components/ui/sign-in-card-2';

const CustomerAuth = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
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
        if (fromPath && !isProtectedRoute(fromPath) && fromPath !== '/login' && fromPath !== '/signup') {
            navigate(fromPath, { replace: true });
            return;
        }

        navigate('/', { replace: true });
    };

    const [isLogin, setIsLogin] = useState(true);
    const [showOtp, setShowOtp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(0);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        otp: '',
        referralCode: '',
    });

    useEffect(() => {
        let interval = null;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!formData.phone || formData.phone.length !== 10) {
            toast.error(t('enterValidPhone'));
            return;
        }

        if (!isLogin && !formData.name.trim()) {
            toast.error(t('enterFullName'));
            return;
        }

        setIsLoading(true);
        try {
            if (isLogin) {
                await customerApi.sendLoginOtp({ phone: formData.phone });
            } else {
                await customerApi.sendSignupOtp({
                    name: formData.name,
                    phone: formData.phone,
                    referralCode: formData.referralCode
                });
            }
            toast.success(t('otpSentSuccess'));
            setShowOtp(true);
            setTimer(30);
        } catch (error) {
            const apiMessage = error?.response?.data?.message;
            toast.error(apiMessage || t('otpSendFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!formData.otp || formData.otp.length !== 4) {
            toast.error(t('enterValid4DigitOtp'));
            return;
        }

        setIsLoading(true);
        try {
            const response = await customerApi.verifyOtp({
                phone: formData.phone,
                otp: formData.otp
            });
            const { token, customer } = response.data.result;

            invalidateCache('/customer/profile');
            login({ ...customer, token, role: 'customer' });
            toast.success(t('loggedInSuccess'));
            const targetPath = (fromPath && fromPath !== '/login' && fromPath !== '/signup')
                ? fromPath 
                : '/';
            navigate(targetPath, { replace: true });
        } catch (error) {
            const apiMessage = error?.response?.data?.message;
            toast.error(apiMessage || t('invalidOtp'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SignInCard2
            onBack={handleClose}
            icon={showOtp ? ShieldCheck : ShoppingBag}
            iconBg="bg-gradient-to-br from-[#2875E8] to-[#1559bd] text-white"
            iconColor="text-white"
            title={!showOtp ? (isLogin ? 'Log in for the best experience' : 'Create your account') : 'Verify with OTP'}
            subtitle={!showOtp ? (isLogin ? 'Enter your phone number to continue' : 'Enter your details to get started') : `${t('sentTo')} +91 ${formData.phone}`}
            logoUrl={settings?.logoUrl || "/logo.png"}
            appName="Anushka Store"
            bgImageUrl="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1920&q=80"
            footer={
                !showOtp ? (
                    <p className="text-xs font-semibold text-slate-500">
                        {isLogin ? "New user? " : "Already have an account? "}
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-[#2875E8] font-bold hover:underline transition-colors ml-0.5"
                        >
                            {isLogin ? 'Create an account' : 'Login'}
                        </button>
                    </p>
                ) : null
            }
        >
            {!showOtp ? (
                <form className="space-y-4" onSubmit={handleSendOtp}>
                    {!isLogin && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold tracking-wider text-[#0F172A] uppercase mb-1.5 px-0.5">
                                    FULL NAME
                                </label>
                                <input
                                    required
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    placeholder="Enter Full Name"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-[#0F172A] outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#2875E8] focus:ring-2 focus:ring-blue-100 transition-all"
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold tracking-wider text-[#0F172A] uppercase mb-1.5 px-0.5">
                                    REFERRAL CODE (OPTIONAL)
                                </label>
                                <input
                                    type="text"
                                    name="referralCode"
                                    value={formData.referralCode}
                                    placeholder="Enter Referral Code"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-[#0F172A] outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#2875E8] focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                                    onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-bold tracking-wider text-[#0F172A] uppercase mb-1.5 px-0.5">
                            MOBILE NUMBER
                        </label>
                        <div className="relative flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#2875E8] focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-slate-50 focus-within:bg-white">
                            <div className="pl-4 pr-3 py-3.5 font-bold text-[#0F172A] text-sm border-r border-slate-200/80 bg-slate-100/70 shrink-0">
                                +91
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
                                className="w-full px-4 py-3.5 text-sm font-semibold text-[#0F172A] outline-none bg-transparent placeholder:text-slate-400"
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-3 relative bg-[#ff641d] hover:bg-[#ed5712] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-orange-500/20 focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 text-sm cursor-pointer"
                    >
                        <span>{isLoading ? t('pleaseWait') : (isLogin ? 'Continue' : 'Create Account')}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>
            ) : (
                <>
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <input
                            type="tel"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={4}
                            aria-label="OTP"
                            placeholder="XXXX"
                            className="w-full text-center tracking-[0.3em] text-2xl font-semibold"
                            value={formData.otp}
                            onChange={(e) => setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        />

                        <div className="space-y-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative bg-[#ff641d] hover:bg-[#ed5712] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-orange-500/20 focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                            >
                                <span>{isLoading ? t('verifying') : 'Verify'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    disabled={timer > 0}
                                    onClick={handleSendOtp}
                                    className={`text-xs font-semibold ${timer > 0 ? 'text-slate-400' : 'text-[#2875E8] hover:underline'}`}
                                >
                                    {timer > 0 ? `${t('resendIn')} ${timer}s` : t('resendCode')}
                                </button>
                            </div>
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setShowOtp(false)}
                                    className="text-sm font-semibold text-[#2468d8] hover:underline"
                                >
                                    Change Mobile Number
                                </button>
                            </div>
                        </div>
                    </form>
                </>
            )}
        </SignInCard2>
    );
};

export default CustomerAuth;
