import React, { useState, useEffect } from 'react';

const SplashScreen = ({ children }) => {
    const [showSplash, setShowSplash] = useState(() => {
        if (typeof window === 'undefined') return false;
        try {
            const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
            const isMobile = window.innerWidth <= 768;
            return isMobile && !hasSeenSplash;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (!showSplash) return;

        const timer = setTimeout(() => {
            setShowSplash(false);
            try {
                sessionStorage.setItem('hasSeenSplash', 'true');
            } catch (err) {}
        }, 2500); // 2.5 seconds

        return () => clearTimeout(timer);
    }, [showSplash]);

    if (showSplash) {
        let splashImage = "/init page .png";
        if (window.location.pathname.startsWith('/delivery')) {
            splashImage = "/driverinit page .png";
        }
        
        return (
            <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center overflow-hidden lg:hidden">
                <img 
                    src={splashImage} 
                    alt="App Init" 
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    return children;
};

export default SplashScreen;
