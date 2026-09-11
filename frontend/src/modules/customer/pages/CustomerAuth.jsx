import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../services/customerApi';
import { toast } from 'sonner';
import { ChevronLeft, Globe, ChevronDown, ArrowRight } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation, languages } from '@core/context/LanguageContext';
import SignInCard2 from '@/components/ui/sign-in-card-2';

const CustomerAuth = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { settings } = useSettings();
    const { language, setLanguage, t } = useTranslation();
    const [isLangOpen, setIsLangOpen] = useState(false);
    const dropdownRef = useRef(null);

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
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            const endpoint = isLogin ? '/customer/auth/send-otp' : '/customer/auth/signup/send-otp';
            const payload = isLogin
                ? { phone: formData.phone }
                : { name: formData.name, phone: formData.phone, referralCode: formData.referralCode };

            await customerApi.post(endpoint, payload);
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
            const endpoint = isLogin ? '/customer/auth/verify-otp' : '/customer/auth/signup/verify-otp';
            const payload = isLogin
                ? { phone: formData.phone, otp: formData.otp }
                : { name: formData.name, phone: formData.phone, otp: formData.otp, referralCode: formData.referralCode };

            const response = await customerApi.post(endpoint, payload);
            const { token, customer } = response.data.result;
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
            title={!showOtp ? t('loginSignup') : t('verifyOtp')}
            subtitle={!showOtp ? (isLogin ? t('enterMobile') : t('createAccount')) : `${t('sentTo')} +91 ${formData.phone}`}
            logoUrl={settings?.logoUrl || "/logo.png"}
            appName="Anushka Store"
        >
            {/* Language Switcher Section */}
            <div className="mb-6 pb-4 border-b border-white/10 flex flex-col items-center">
                {/* Desktop Dropdown */}
                <div ref={dropdownRef} className="hidden md:block relative w-full">
                    <button
                        type="button"
                        onClick={() => setIsLangOpen(!isLangOpen)}
                        className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition-all focus:outline-none"
                    >
                        <div className="flex items-center gap-2">
                            <Globe size={16} className="text-slate-400" />
                            <span>{languages.find(l => l.code === language)?.flag} {languages.find(l => l.code === language)?.name}</span>
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isLangOpen && (
                        <div className="absolute right-0 left-0 mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => {
                                        setLanguage(lang.code);
                                        setIsLangOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10 ${language === lang.code ? 'bg-blue-600/30 text-blue-400 font-bold' : 'text-slate-300'}`}
                                >
                                    <span className="text-base">{lang.flag}</span>
                                    <span>{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mobile language pills */}
                <div className="block md:hidden w-full">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Globe size={12} /> Language / भाषा
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-start">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                type="button"
                                onClick={() => setLanguage(lang.code)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                                    language === lang.code
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                }`}
                            >
                                <span>{lang.flag}</span>
                                <span>{lang.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {!showOtp ? (
                <>
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

                    <form className="space-y-4" onSubmit={handleSendOtp}>
                        {!isLogin && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        required
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        placeholder={t('fullName')}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="referralCode"
                                        value={formData.referralCode}
                                        placeholder={t('referralCode')}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:bg-white/10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all uppercase"
                                        onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="relative flex items-center border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/30 transition-all bg-white/5 focus-within:bg-white/10">
                            <div className="pl-4 pr-3 py-3.5 font-bold text-slate-300 border-r border-white/10 bg-white/5">
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
                                placeholder={isLogin ? "9671310143" : t('mobileNumber')}
                                className="w-full px-4 py-3.5 text-sm font-semibold text-white outline-none bg-transparent placeholder:text-slate-500"
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-500 hover:from-blue-700 hover:to-orange-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <span>{isLoading ? t('pleaseWait') : t('continue')}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                        >
                            {isLogin ? t('newUser') : t('alreadyAccount')}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center justify-start gap-2 mb-4">
                        <button
                            onClick={() => setShowOtp(false)}
                            className="text-slate-400 hover:text-white transition-colors p-1"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-xs font-medium text-slate-400">Change number</span>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <div className="flex justify-center gap-2">
                            {[...Array(4)].map((_, i) => (
                                <input
                                    key={i}
                                    type="tel"
                                    maxLength={1}
                                    className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-xl font-bold text-white outline-none focus:bg-white/10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
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
                                className="w-full relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-500 hover:from-blue-700 hover:to-orange-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? t('verifying') : t('verifyProceed')}
                            </button>
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    disabled={timer > 0}
                                    onClick={handleSendOtp}
                                    className={`text-xs font-semibold ${timer > 0 ? 'text-slate-500' : 'text-orange-400 hover:underline'}`}
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
                <div className="pt-6 flex flex-col items-center gap-1.5 border-t border-white/10 mt-6">
                    <p className="text-[11px] text-slate-500 text-center font-medium">
                        {t('agreeText')}
                    </p>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => navigate('/support')}
                            className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                        >
                            {t('terms')}
                        </button>
                        <span className="text-[10px] text-slate-600">•</span>
                        <button 
                            onClick={() => navigate('/privacy')}
                            className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                        >
                            {t('privacy')}
                        </button>
                    </div>
                </div>
            )}
        </SignInCard2>
    );
};

export default CustomerAuth;
