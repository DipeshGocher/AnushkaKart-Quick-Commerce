import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';
import { resolveApiBaseUrl } from '@/core/api/resolveApiBaseUrl';

/**
 * Checks genuine connectivity by probing the backend /health endpoint,
 * with a fallback to Google's connectivity check 204.
 */
async function pingRealInternet(timeoutMs = 3000) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return false;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const apiBase = resolveApiBaseUrl();
        const res = await fetch(`${apiBase}/health?_t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timer);
        return res.ok;
    } catch {
        clearTimeout(timer);
        // Fallback: probe public connectivity endpoint
        try {
            const fallbackController = new AbortController();
            const fallbackTimer = setTimeout(() => fallbackController.abort(), 2000);
            await fetch(`https://connectivitycheck.gstatic.com/generate_204?_t=${Date.now()}`, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store',
                signal: fallbackController.signal,
            });
            clearTimeout(fallbackTimer);
            return true;
        } catch {
            return false;
        }
    }
}

const OfflineBanner = () => {
    const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
    const [isRestored, setIsRestored] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [retryFailed, setRetryFailed] = useState(false);
    const restoredTimerRef = useRef(null);

    const checkConnectivity = useCallback(async () => {
        setIsChecking(true);
        setRetryFailed(false);
        try {
            const genuinelyConnected = await pingRealInternet(3000);
            if (genuinelyConnected) {
                setIsOffline(false);
                setIsRestored(true);
                setRetryFailed(false);
                if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
                restoredTimerRef.current = setTimeout(() => {
                    setIsRestored(false);
                }, 2500);
                window.dispatchEvent(new Event('app:network-restored'));
            } else {
                setIsOffline(true);
                setIsRestored(false);
                setRetryFailed(true);
                setTimeout(() => setRetryFailed(false), 2500);
            }
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        const handleOnline = async () => {
            // Verify real connection before showing "Connected"
            const genuinelyConnected = await pingRealInternet(2500);
            if (genuinelyConnected) {
                setIsOffline(false);
                setIsRestored(true);
                setRetryFailed(false);
                if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
                restoredTimerRef.current = setTimeout(() => {
                    setIsRestored(false);
                }, 2500);
                window.dispatchEvent(new Event('app:network-restored'));
            } else {
                setIsOffline(true);
                setIsRestored(false);
            }
        };

        const handleOffline = () => {
            if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
            setIsRestored(false);
            setIsOffline(true);
            setRetryFailed(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
        };
    }, []);

    const showBanner = isOffline || isRestored;

    return (
        <AnimatePresence>
            {showBanner && (
                <div className="fixed top-0 inset-x-0 z-[999999] pointer-events-none flex justify-center px-3 pt-2">
                    <motion.div
                        key={isOffline ? (retryFailed ? 'offline-failed' : 'offline') : 'restored'}
                        initial={{ y: -60, opacity: 0, scale: 0.95 }}
                        animate={
                            retryFailed
                                ? { x: [-6, 6, -4, 4, -2, 2, 0], y: 0, opacity: 1, scale: 1 }
                                : { y: 0, opacity: 1, scale: 1 }
                        }
                        exit={{ y: -60, opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className={`pointer-events-auto max-w-md w-full shadow-2xl rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-white border backdrop-blur-md ${
                            isOffline
                                ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 border-rose-400/30'
                                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 border-emerald-400/30'
                        }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                    isOffline ? 'bg-white/15' : 'bg-white/20'
                                }`}
                            >
                                {isOffline ? (
                                    <WifiOff className="w-4 h-4 text-white animate-pulse" />
                                ) : (
                                    <Wifi className="w-4 h-4 text-white" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold leading-tight truncate">
                                    {isOffline
                                        ? (retryFailed ? 'Still Offline' : 'No Internet Connection')
                                        : 'Connected!'}
                                </p>
                                <p className="text-[11px] text-white/85 leading-tight truncate mt-0.5">
                                    {isOffline
                                        ? (retryFailed
                                              ? 'No connection found. Please check data/Wi-Fi'
                                              : 'Please check your mobile data or Wi-Fi')
                                        : 'Internet connection has been restored'}
                                </p>
                            </div>
                        </div>

                        {isOffline ? (
                            <button
                                type="button"
                                onClick={checkConnectivity}
                                disabled={isChecking}
                                className="shrink-0 text-[11px] font-bold bg-white text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 active:scale-95 transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-60"
                            >
                                <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                                {isChecking ? 'Checking...' : 'Retry'}
                            </button>
                        ) : (
                            <div className="shrink-0 flex items-center text-white/90">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default OfflineBanner;
