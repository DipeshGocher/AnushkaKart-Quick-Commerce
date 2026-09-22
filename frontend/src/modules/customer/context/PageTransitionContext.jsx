import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import LottieTransitionOverlay from '../components/shared/LottieTransitionOverlay';
import WeChatStyleTransitionOverlay from '../components/shared/WeChatStyleTransitionOverlay';

export const globalLoadingManager = {
    start: null,
    stop: null
};

const PageTransitionContext = createContext(null);

export const usePageTransition = () => useContext(PageTransitionContext);

export const PageTransitionProvider = ({ children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isNetworkLoading, setIsNetworkLoading] = useState(false);
    const [iconTransition, setIconTransition] = useState(null);
    const location = useLocation();
    const isFirstMount = useRef(true);
    const prevLocationRef = useRef(location.pathname);

    // Trigger transition on route change (excluding refurbished section)
    useEffect(() => {
        const prev = prevLocationRef.current;
        const curr = location.pathname;
        prevLocationRef.current = curr;

        if (isFirstMount.current) {
            isFirstMount.current = false;
            if (!curr.startsWith('/marketplace') && !curr.startsWith('/refurbished')) {
                setIsVisible(true);
            }
            return;
        }

        const isMarketplaceTransition = 
            prev.startsWith('/marketplace') || curr.startsWith('/marketplace') ||
            prev.startsWith('/refurbished') || curr.startsWith('/refurbished');
        if (!isMarketplaceTransition) {
            setIsVisible(true);
        }
    }, [location.pathname]);

    const handleAnimationComplete = () => {
        // Only hide if it's a page transition (not a network loading state)
        if (!isNetworkLoading) {
            setIsVisible(false);
        }
    };

    useEffect(() => {
        const handleStart = () => {
            if (window.location.pathname.startsWith('/marketplace') || window.location.pathname.startsWith('/refurbished')) return;
            setIsNetworkLoading(true);
            setIsVisible(true);
        };
        const handleStop = () => {
            setIsNetworkLoading(false);
            setIsVisible(false);
        };

        globalLoadingManager.start = handleStart;
        globalLoadingManager.stop = handleStop;

        return () => {
            globalLoadingManager.start = null;
            globalLoadingManager.stop = null;
        };
    }, []);

    const startLoading = () => {
        if (location.pathname.startsWith('/marketplace') || location.pathname.startsWith('/refurbished')) return;
        setIsNetworkLoading(true);
        setIsVisible(true);
    };

    const stopLoading = () => {
        setIsNetworkLoading(false);
        setIsVisible(false);
    };

    const triggerIconFillTransition = (type, onNavigate) => {
        setIconTransition({ type });
        
        // Execute navigation 600ms into animation for snappy page load
        setTimeout(() => {
            if (onNavigate) onNavigate();
        }, 600);

        // Clear overlay after ~1.5s total display duration (1s shorter)
        setTimeout(() => {
            setIconTransition(null);
        }, 1500);
    };

    return (
        <PageTransitionContext.Provider value={{ startLoading, stopLoading, triggerIconFillTransition }}>
            {children}
            <LottieTransitionOverlay 
                isVisible={isVisible && !iconTransition} 
                isNetworkLoading={isNetworkLoading} 
                onComplete={handleAnimationComplete}
            />
            <WeChatStyleTransitionOverlay 
                transitionData={iconTransition} 
            />
        </PageTransitionContext.Provider>
    );
};
