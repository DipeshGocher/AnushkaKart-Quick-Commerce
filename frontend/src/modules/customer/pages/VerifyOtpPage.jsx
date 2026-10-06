import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../services/customerApi';
import { invalidateCache } from '@core/api/dedupe';
import { toast } from 'sonner';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import SignInCard2 from '@/components/ui/sign-in-card-2';

const VerifyOtpPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const { settings } = useSettings();
    const { t } = useTranslation();

    // Retrieve state from navigation or sessionStorage fallback
    const [authData] = useState(() => {
        if (location.state?.phone) {
            return location.state;
        }
        try {
            const stored = sessionStorage.getItem('anushka_pending_auth');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    });

    const phone = authData?.phone || '';
    const name = authData?.name || '';
    const isLogin = authData?.isLogin ?? true;
    const fromPath = authData?.from || null;

    // 4 OTP digit boxes state
    const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [timer, setTimer] = useState(30);

    const inputRefs = useRef([]);

    // Redirect to login if no phone number available
    useEffect(() => {
        if (!phone) {
            navigate('/login', { replace: true });
        }
    }, [phone, navigate]);

    // Focus first empty box on mount
    useEffect(() => {
        if (phone && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [phone]);

    // Resend countdown timer
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

    const handleChangeNumber = () => {
        navigate(isLogin ? '/login' : '/signup', {
            state: { phone, name, isLogin, from: fromPath },
            replace: true
        });
    };

    const handleDigitChange = (index, value) => {
        const cleaned = value.replace(/\D/g, '');
        if (!cleaned) {
            const nextDigits = [...otpDigits];
            nextDigits[index] = '';
            setOtpDigits(nextDigits);
            return;
        }

        // If user typed/pasted multiple digits into one box
        if (cleaned.length > 1) {
            handlePasteDigits(cleaned, index);
            return;
        }

        const digit = cleaned.slice(-1);
        const nextDigits = [...otpDigits];
        nextDigits[index] = digit;
        setOtpDigits(nextDigits);

        // Auto focus next box
        if (index < 3 && digit) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace') {
            if (!otpDigits[index] && index > 0) {
                // Focus previous box and delete its content
                const nextDigits = [...otpDigits];
                nextDigits[index - 1] = '';
                setOtpDigits(nextDigits);
                inputRefs.current[index - 1]?.focus();
                e.preventDefault();
            } else if (otpDigits[index]) {
                const nextDigits = [...otpDigits];
                nextDigits[index] = '';
                setOtpDigits(nextDigits);
                e.preventDefault();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePasteDigits = (pastedText, startIndex = 0) => {
        const digits = pastedText.replace(/\D/g, '').slice(0, 4);
        if (!digits) return;

        const nextDigits = [...otpDigits];
        for (let i = 0; i < digits.length; i++) {
            const targetIdx = startIndex + i;
            if (targetIdx < 4) {
                nextDigits[targetIdx] = digits[i];
            }
        }
        setOtpDigits(nextDigits);

        const focusTarget = Math.min(startIndex + digits.length, 3);
        inputRefs.current[focusTarget]?.focus();
    };

    const handlePaste = (e, index) => {
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('text');
        handlePasteDigits(clipboardData, index);
    };

    const handleResendOtp = async () => {
        if (timer > 0 || isResending) return;

        setIsResending(true);
        try {
            if (isLogin) {
                await customerApi.sendLoginOtp({ phone });
            } else {
                await customerApi.sendSignupOtp({ name, phone });
            }
            toast.success(t('otpSentSuccess') || 'OTP sent successfully!');
            setTimer(30);
            setOtpDigits(['', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (error) {
            const apiMessage = error?.response?.data?.message;
            toast.error(apiMessage || t('otpSendFailed') || 'Failed to resend OTP');
        } finally {
            setIsResending(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        if (e) e.preventDefault();
        const otpString = otpDigits.join('');

        if (otpString.length !== 4) {
            toast.error(t('enterValid4DigitOtp') || 'Please enter a valid 4-digit OTP');
            return;
        }

        setIsLoading(true);
        try {
            const response = await customerApi.verifyOtp({
                phone,
                otp: otpString
            });
            const { token, customer } = response.data.result;

            sessionStorage.removeItem('anushka_pending_auth');
            invalidateCache('/customer/profile');
            login({ ...customer, token, role: 'customer' });
            toast.success(t('loggedInSuccess') || 'Successfully Logged In!');

            const targetPath = (fromPath && fromPath !== '/login' && fromPath !== '/signup' && fromPath !== '/verify-otp')
                ? fromPath 
                : '/';
            navigate(targetPath, { replace: true });
        } catch (error) {
            const apiMessage = error?.response?.data?.message;
            toast.error(apiMessage || t('invalidOtp') || 'Invalid OTP');
            // Shake/refocus
            inputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const isOtpComplete = otpDigits.every(d => d !== '');

    if (!phone) {
        return null;
    }

    return (
        <SignInCard2
            containerClassName="customer-app"
            onBack={handleClose}
            icon={ShieldCheck}
            iconBg="bg-gradient-to-br from-[#7777FF] to-[#6666FF] text-white"
            iconColor="text-white"
            title="Verify with OTP"
            subtitle={`${t('sentTo') || 'Sent to'} +91 ${phone}`}
            logoUrl={settings?.logoUrl || "/logo.png"}
            appName="Anushka Store"
            bgImageUrl="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1920&q=80"
        >
            <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* 4 Stylish Individual OTP Digit Boxes */}
                <div className="flex items-center justify-center gap-3 sm:gap-4 my-2">
                    {otpDigits.map((digit, index) => {
                        const isFilled = Boolean(digit);
                        return (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoComplete={index === 0 ? "one-time-code" : "off"}
                                maxLength={1}
                                value={digit}
                                aria-label={`OTP Digit ${index + 1}`}
                                onChange={(e) => handleDigitChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={(e) => handlePaste(e, index)}
                                className={`otp-box ${isFilled ? 'is-filled' : ''} text-2xl sm:text-3xl font-extrabold text-center rounded-2xl border-2 transition-all duration-200 outline-none select-none ${
                                    isFilled
                                        ? 'border-[#6666FF] bg-[#6666FF]/10 text-[#0F172A] shadow-sm'
                                        : 'border-slate-300 bg-slate-50 text-[#0F172A] hover:border-slate-400'
                                } focus:border-[#6666FF] focus:bg-white focus:ring-4 focus:ring-[#6666FF]/25 focus:scale-105 focus:text-[#6666FF]`}
                            />
                        );
                    })}
                </div>

                <div className="space-y-4">
                    {/* Primary Verify Button */}
                    <button
                        type="submit"
                        disabled={isLoading || !isOtpComplete}
                        className="w-full relative bg-gradient-to-r from-[#7777FF] via-[#6666FF] to-[#5555EE] hover:from-[#6666FF] hover:to-[#4F4FDD] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-[#6666FF]/25 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>{t('verify') || 'Verify OTP'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    {/* Resend Code with Countdown */}
                    <div className="flex justify-center">
                        <button
                            type="button"
                            disabled={timer > 0 || isResending}
                            onClick={handleResendOtp}
                            className={`text-xs font-semibold transition-colors ${
                                timer > 0
                                    ? 'text-slate-400 cursor-default'
                                    : 'text-[#6666FF] hover:text-[#5555EE] hover:underline cursor-pointer'
                            }`}
                        >
                            {isResending
                                ? (t('pleaseWait') || 'Please wait...')
                                : (timer > 0 ? `${t('resendIn') || 'Resend Code in'} ${timer}s` : (t('resendCode') || 'Resend Code'))}
                        </button>
                    </div>

                    {/* Change Mobile Number */}
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={handleChangeNumber}
                            className="text-xs sm:text-sm font-semibold text-[#6666FF] hover:text-[#5555EE] hover:underline cursor-pointer"
                        >
                            Change Mobile Number
                        </button>
                    </div>
                </div>
            </form>
        </SignInCard2>
    );
};

export default VerifyOtpPage;
