import { useEffect, useRef } from 'react';
import { useSettings } from '@core/context/SettingsContext';

/**
 * Updates document title, favicon, and meta description/keywords from global settings.
 * Must be rendered inside SettingsProvider.
 */
export default function SeoHead() {
    const { settings } = useSettings();
    const metaRefs = useRef({ description: null, keywords: null, favicon: null });

    useEffect(() => {
        if (!settings) return;

        const title = settings.metaTitle || settings.appName || 'App';
        document.title = title;

        const desc = settings.metaDescription || '';
        const keywordsContent = (Array.isArray(settings.keywords) && settings.keywords.length)
            ? settings.keywords.join(', ')
            : (settings.metaKeywords || '');

        // Update or create meta description
        let metaDesc = metaRefs.current.description;
        if (!metaDesc) {
            metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaRefs.current.description = metaDesc;
        }
        metaDesc.setAttribute('content', desc);

        // Update or create meta keywords
        let metaKw = metaRefs.current.keywords;
        if (!metaKw) {
            metaKw = document.querySelector('meta[name="keywords"]');
            if (!metaKw) {
                metaKw = document.createElement('meta');
                metaKw.setAttribute('name', 'keywords');
                document.head.appendChild(metaKw);
            }
            metaRefs.current.keywords = metaKw;
        }
        metaKw.setAttribute('content', keywordsContent);

        // Update or create dynamic favicon across all icon link tags
        const activeFavicon = (settings?.faviconUrl && settings.faviconUrl.trim() !== '')
            ? settings.faviconUrl.trim()
            : '/logo.png';

        const updateOrCreateLink = (rel, href, type) => {
            let el = document.querySelector(`link[rel="${rel}"]`);
            if (!el) {
                el = document.createElement('link');
                el.rel = rel;
                document.head.appendChild(el);
            }
            el.href = href;
            if (type) el.type = type;
            return el;
        };

        const iconType = activeFavicon.endsWith('.svg')
            ? 'image/svg+xml'
            : activeFavicon.endsWith('.ico')
                ? 'image/x-icon'
                : 'image/png';

        updateOrCreateLink('icon', activeFavicon, iconType);
        updateOrCreateLink('shortcut icon', activeFavicon, iconType);
        updateOrCreateLink('apple-touch-icon', activeFavicon, iconType);
    }, [settings]);

    return null;
}
