import { Suspense, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import AppRouter from '@core/routes/AppRouter';
import { AuthProvider } from '@core/context/AuthContext';
import { SettingsProvider } from '@core/context/SettingsContext';
import { SupportUnreadProvider } from '@core/context/SupportUnreadContext';
import { LanguageProvider } from '@core/context/LanguageContext';
import SeoHead from '@core/components/SeoHead';
import { ToastProvider } from './shared/components/ui/Toast';
import PageSkeleton from './shared/components/PageSkeleton';
import ErrorBoundary from './shared/components/ErrorBoundary';
import LenisScroll from './shared/components/LenisScroll';
import OfflineBanner from './shared/components/OfflineBanner';

function App() {
    useEffect(() => {
        // Setup hardware back button listener for Android apps
        let lastBackTime = 0;

        const setupBackButton = async () => {
            try {
                await CapacitorApp.addListener('backButton', () => {
                    const now = Date.now();
                    if (now - lastBackTime < 350) return;
                    lastBackTime = now;

                    // 1. If any modal or drawer dialog is open, close it first via Escape
                    const openModal = document.querySelector('[role="dialog"]');
                    if (openModal) {
                        window.dispatchEvent(new KeyboardEvent('keydown', {
                            key: 'Escape',
                            code: 'Escape',
                            keyCode: 27,
                            which: 27,
                            bubbles: true
                        }));
                        return;
                    }

                    // 2. Check current route
                    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
                    const isRootPage = currentPath === '/' || currentPath === '/home';

                    // 3. If on an inner page, navigate back in history
                    if (!isRootPage) {
                        const historyIdx = window.history?.state?.idx;
                        if (typeof historyIdx === 'number' && historyIdx > 0) {
                            window.history.back();
                        } else if (window.history.length > 1) {
                            window.history.back();
                        } else {
                            if (currentPath.startsWith('/checkout')) {
                                window.location.href = '/cart';
                            } else {
                                window.location.href = '/';
                            }
                        }
                        return;
                    }

                    // 4. Only exit when user is already on the root/home page
                    CapacitorApp.exitApp();
                });
            } catch (err) {
                // Ignore errors if running in a standard web browser (not capacitor)
            }
        };
        setupBackButton();
        
        return () => {
            try {
                CapacitorApp.removeAllListeners();
            } catch (err) {}
        };
    }, []);

    return (
        <ErrorBoundary>
            <AuthProvider>
                <LanguageProvider>
                    <SettingsProvider>
                        <SeoHead />
                        <ToastProvider>
                            <OfflineBanner />
                            <Suspense fallback={<PageSkeleton />}>
                                <SupportUnreadProvider>
                                    <LenisScroll />
                                    <AppRouter />
                                </SupportUnreadProvider>
                            </Suspense>
                        </ToastProvider>
                    </SettingsProvider>
                </LanguageProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
