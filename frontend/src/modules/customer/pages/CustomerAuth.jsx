import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../services/customerApi';
import { invalidateCache } from '@core/api/dedupe';
import { toast } from 'sonner';
import { ChevronLeft, ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import SignInCard2 from '@/components/ui/sign-in-card-2';

const CustomerAuth = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { settings } = useSettings();
    const { t } = useTranslation();

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
            navigate('/', { replace: true });
        } catch (error) {
            const apiMessage = error?.response?.data?.message;
            toast.error(apiMessage || t('invalidOtp'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SignInCard2
            icon={showOtp ? ShieldCheck : ShoppingBag}
            iconBg="bg-gradient-to-br from-[#FF5722] via-[#FF6D00] to-[#0F172A] text-white"
            iconColor="text-white"
            title={!showOtp ? (isLogin ? 'Welcome Back' : 'Create Account') : 'Verify OTP'}
            subtitle={!showOtp ? (isLogin ? 'Login to access your orders' : 'Register to get started') : `${t('sentTo')} +91 ${formData.phone}`}
            logoUrl={settings?.logoUrl || "/logo.png"}
            appName="Anushka Store"
            footer={
                !showOtp ? (
                    <p className="text-xs font-semibold text-slate-500">
                        {isLogin ? "New user? " : "Already have an account? "}
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-[#FF5722] font-bold hover:underline transition-colors ml-0.5"
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
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-[#0F172A] outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/20 transition-all"
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
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-[#0F172A] outline-none placeholder:text-slate-400 focus:bg-white focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/20 transition-all uppercase"
                                    onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[11px] font-bold tracking-wider text-[#0F172A] uppercase mb-1.5 px-0.5">
                            PHONE NUMBER
                        </label>
                        <div className="relative flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#FF5722] focus-within:ring-2 focus-within:ring-[#FF5722]/20 transition-all bg-slate-50 focus-within:bg-white">
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
                        className="w-full mt-3 relative bg-gradient-to-r from-[#FF5722] via-[#FF6D00] to-[#0F172A] hover:from-[#FF6D00] hover:to-[#0F172A] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-orange-500/25 focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                        <span>{isLoading ? t('pleaseWait') : (isLogin ? 'Continue' : 'Create Account')}</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </form>
            ) : (
                <>
                    <div className="flex items-center justify-start gap-2 mb-4">
                        <button
                            onClick={() => setShowOtp(false)}
                            className="text-slate-500 hover:text-[#0F172A] transition-colors p-1"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-xs font-semibold text-slate-600">Change number</span>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className="flex justify-center gap-2">
                            {[...Array(4)].map((_, i) => (
                                <input
                                    key={i}
                                    type="tel"
                                    maxLength={1}
                                    className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold text-[#0F172A] outline-none focus:bg-white focus:border-[#FF5722] focus:ring-2 focus:ring-[#FF5722]/20 transition-all"
                                    value={formData.otp[i] || ''}
                                    onKeyDown={(e) => {
                                        const target = /** @type {HTMLInputElement} */ (e.currentTarget);
                                        if (e.key === 'Backspace' && !target.value && i > 0) {
                                            const prev = /** @type {HTMLInputElement | null} */ (target.previousElementSibling);
                                            if (prev) prev.focus();
                                        }
                                    }}
                                    onChange={(e) => {
                                        const target = /** @type {HTMLInputElement} */ (e.currentTarget);
                                        const val = target.value;
                                        if (val && i < 3) {
                                            const next = /** @type {HTMLInputElement | null} */ (target.nextElementSibling);
                                            if (next) next.focus();
                                        }
                                        const otpArr = formData.otp.split('');
                                        otpArr[i] = val;
                                        setFormData({ ...formData, otp: otpArr.join('') });
                                    }}
                                />
                            ))}
                        </div>

                        <div className="space-y-4">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative bg-gradient-to-r from-[#FF5722] via-[#FF6D00] to-[#0F172A] hover:from-[#FF6D00] hover:to-[#0F172A] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-orange-500/25 focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                            >
                                <span>{isLoading ? t('verifying') : t('verifyProceed')}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    disabled={timer > 0}
                                    onClick={handleSendOtp}
                                    className={`text-xs font-semibold ${timer > 0 ? 'text-slate-400' : 'text-[#FF5722] hover:underline'}`}
                                >
                                    {timer > 0 ? `${t('resendIn')} ${timer}s` : t('resendCode')}
                                </button>
                            </div>
                        </div>
                    </form>
                </>
            )}

            {/* Legal Agreement Footer */}
            {!showOtp && (
                <div className="pt-5 flex flex-col items-center gap-1 border-t border-slate-100 mt-5">
                    <p className="text-[11px] text-slate-400 text-center font-medium">
                        By continuing, you agree to our
                    </p>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => navigate('/support')}
                            className="text-[11px] font-semibold text-slate-500 hover:text-[#FF5722] transition-colors"
                        >
                            Terms & Conditions
                        </button>
                        <span className="text-[10px] text-slate-300">•</span>
                        <button 
                            onClick={() => navigate('/privacy')}
                            className="text-[11px] font-semibold text-slate-500 hover:text-[#FF5722] transition-colors"
                        >
                            Privacy Policy
                        </button>
                    </div>
                </div>
            )}
        </SignInCard2>
    );
};

export default CustomerAuth;
