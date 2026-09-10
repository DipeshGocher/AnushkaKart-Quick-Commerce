import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import { ChevronLeft, Globe, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';

const CustomerAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [timer, setTimer] = useState(0);
    const { login } = useAuth();
    const { settings } = useSettings();
    const { t, language, setLanguage, languages } = useTranslation();
    const [isLangOpen, setIsLangOpen] = useState(false);
    const dropdownRef = useRef(null);
    const appName = settings?.appName || 'App';
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        phone: '',
        otp: '',
        name: '',
        referralCode: new URLSearchParams(window.location.search).get('ref') || ''
    });

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSendOtp = async (e) => {
        e?.preventDefault();
        if (formData.phone.length !== 10) {
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
            setShowOtp(true);
            setTimer(30);
            toast.success(t('otpSent'));
        } catch (error) {
            const apiMessage = error?.response?.data?.message || 'Failed to send OTP';
            toast.error(apiMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (formData.otp.length !== 4) {
            toast.error('Enter 4-digit code');
            return;
        }
        setIsLoading(true);
        try {
            const response = await customerApi.verifyOtp({ phone: formData.phone, otp: formData.otp });
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50 px-4 py-8 font-['Outfit',_sans-serif]">
            <div className="bg-white text-slate-900 border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto relative overflow-hidden">
                {/* Background Accents */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100/40 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-100/30 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

                <div className="relative z-10">
                    {/* Logo */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <img 
                            src={settings?.logoUrl || "/logo.png"} 
                            alt="AnushkaKart Logo" 
                            className="h-20 sm:h-24 w-auto object-contain" 
                        />
                    </div>

                    {/* Language Switcher Section */}
                    <div className="mb-6 pb-4 border-b border-slate-100 flex flex-col items-center">
                        {/* Desktop Dropdown */}
                        <div ref={dropdownRef} className="hidden md:block relative w-full">
                            <button
                                type="button"
                                onClick={() => setIsLangOpen(!isLangOpen)}
                                className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all focus:outline-none"
                            >
                                <div className="flex items-center gap-2">
                                    <Globe size={16} className="text-slate-400" />
                                    <span>{languages.find(l => l.code === language)?.flag} {languages.find(l => l.code === language)?.name}</span>
                                </div>
                                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isLangOpen && (
                                <div className="absolute right-0 left-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {languages.map((lang) => (
                                        <button
                                            key={lang.code}
                                            type="button"
                                            onClick={() => {
                                                setLanguage(lang.code);
                                                setIsLangOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-slate-50 ${language === lang.code ? 'bg-pink-50 text-[#E60067] font-bold' : 'text-slate-700'}`}
                                        >
                                            <span className="text-base">{lang.flag}</span>
                                            <span>{lang.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Mobile pills */}
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
                                                ? 'bg-[#E60067] border-[#E60067] text-white shadow-sm shadow-[#E60067]/20'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
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
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                                    {t('loginSignup')}
                                </h2>
                                <p className="text-slate-500 text-xs font-medium">
                                    {isLogin ? t('enterMobile') : t('createAccount')}
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
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#E60067] focus:ring-2 focus:ring-[#E60067]/20 transition-all"
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="referralCode"
                                                value={formData.referralCode}
                                                placeholder={t('referralCode')}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#E60067] focus:ring-2 focus:ring-[#E60067]/20 transition-all uppercase"
                                                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="relative flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#E60067] focus-within:ring-2 focus-within:ring-[#E60067]/20 transition-all bg-slate-50 focus-within:bg-white">
                                    <div className="pl-4 pr-3 py-3.5 font-bold text-slate-600 border-r border-slate-200 bg-slate-100/50">
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
                                        className="w-full px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none bg-transparent"
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full mt-2 relative bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? t('pleaseWait') : t('continue')}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => setIsLogin(!isLogin)}
                                    className="text-xs font-semibold text-slate-500 hover:text-[#E60067] transition-colors"
                                >
                                    {isLogin ? t('newUser') : t('alreadyAccount')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center mb-6">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <button
                                        onClick={() => setShowOtp(false)}
                                        className="text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                                        {t('verifyOtp')}
                                    </h2>
                                </div>
                                <p className="text-slate-500 text-xs font-medium">
                                    {t('sentTo')} +91 {formData.phone}
                                </p>
                            </div>

                            <form onSubmit={handleVerifyOtp} className="space-y-6">
                                <div className="flex justify-center gap-2">
                                    {[...Array(4)].map((_, i) => (
                                        <input
                                            key={i}
                                            type="tel"
                                            maxLength={1}
                                            className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold text-slate-900 outline-none focus:bg-white focus:border-[#E60067] focus:ring-2 focus:ring-[#E60067]/20 transition-all"
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
                                        className="w-full relative bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? t('verifying') : t('verifyProceed')}
                                    </button>
                                    <div className="flex justify-center">
                                        <button
                                            type="button"
                                            disabled={timer > 0}
                                            onClick={handleSendOtp}
                                            className={`text-xs font-semibold ${timer > 0 ? 'text-slate-400' : 'text-[#E60067] hover:underline'}`}
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
                        <div className="pt-6 flex flex-col items-center gap-1.5 border-t border-slate-100 mt-6">
                            <p className="text-[11px] text-slate-400 text-center font-medium">
                                {t('agreeText')}
                            </p>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => navigate('/support')}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-[#E60067] transition-colors"
                                >
                                    {t('terms')}
                                </button>
                                <span className="text-[10px] text-slate-300">•</span>
                                <button 
                                    onClick={() => navigate('/privacy')}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-[#E60067] transition-colors"
                                >
                                    {t('privacy')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerAuth;


