import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mic, Search, ShoppingBag, ShoppingCart, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@core/context/SettingsContext';
import { useCart } from '../context/CartContext';
import CategoryIcon from '@shared/components/CategoryIcon';
import { CATEGORY_BANNER_PRESET_VERSION, getCategoryBannerPreset } from '@shared/constants/categoryBannerPresets';

const isForYou = (name) => String(name || '').trim().toLowerCase() === 'for you';

const CategoriesPage = () => {
    const [sections, setSections] = useState([]);
    const [activeHeaderId, setActiveHeaderId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [activeBannerIndex, setActiveBannerIndex] = useState(0);
    const contentPaneRef = useRef(null);
    const sidebarRef = useRef(null);
    const navigate = useNavigate();
    const { settings } = useSettings();
    const { groceryCartCount } = useCart();

    useEffect(() => {
        let isMounted = true;
        const fetchCategories = async () => {
            setIsLoading(true);
            try {
                const response = await customerApi.getCategories({ tree: 'true', catalogType: 'all' });
                if (!response.data?.success) return;

                const tree = response.data.results || response.data.result || response.data.data || [];
                const parsed = tree
                    .filter((header) => !isForYou(header.name))
                    .map((header) => ({
                        id: header._id || header.id,
                        name: header.name,
                        image: header.image || '',
                        iconId: header.iconId || '',
                        sortOrder: header.sortOrder || 0,
                        categories: (header.children || []).map((category) => ({
                            id: category._id || category.id,
                            name: category.name,
                            image: category.image || category.icon || '',
                            sortOrder: category.sortOrder || 0,
                        })).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
                    }))
                    .filter((header) => header.categories.length > 0)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

                if (isMounted) {
                    setSections(parsed);
                    setActiveHeaderId((current) => parsed.some((section) => section.id === current) ? current : parsed[0]?.id || null);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchCategories();
        return () => { isMounted = false; };
    }, []);

    const query = searchQuery.trim().toLowerCase();
    const visibleSections = sections
        .map((section) => ({
            ...section,
            categories: section.categories.filter((category) => !query || category.name.toLowerCase().includes(query)),
        }))
        .filter((section) => !query || section.categories.length > 0 || section.name.toLowerCase().includes(query));

    const activeSection = visibleSections.find((section) => section.id === activeHeaderId) || visibleSections[0] || null;
    const activeHeaderKey = activeSection?.id || '';
    const bannerSlides = settings?.categoriesBanner?.isVisible !== false && activeSection
        ? Number(settings?.categoriesBanner?.presetVersion || 0) >= CATEGORY_BANNER_PRESET_VERSION
            ? (settings?.categoriesBanner?.banners || []).filter((item) => String(item.headerCategoryId || '') === String(activeSection.id) && item.image)
            : (() => {
                const preset = getCategoryBannerPreset(activeSection.name);
                return preset ? [{ image: preset.image, title: activeSection.name, buttonLink: `/category/${activeSection.id}` }] : [];
            })()
        : [];
    const currentBanner = bannerSlides[activeBannerIndex] || bannerSlides[0] || null;

    useEffect(() => {
        setActiveBannerIndex(0);
        if (bannerSlides.length < 2) return undefined;

        const timer = window.setInterval(() => {
            setActiveBannerIndex((index) => (index + 1) % bannerSlides.length);
        }, 4500);
        return () => window.clearInterval(timer);
    }, [activeHeaderKey, bannerSlides.length]);

    useEffect(() => {
        if (activeSection && activeSection.id !== activeHeaderId) setActiveHeaderId(activeSection.id);
    }, [activeSection, activeHeaderId]);

    const selectHeader = (headerId) => {
        setActiveHeaderId(headerId);
        const pane = contentPaneRef.current;
        if (pane) pane.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleVoiceSearch = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-IN';
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);
            recognition.onresult = (event) => {
                setSearchQuery(event.results[0][0].transcript || '');
                setIsListening(false);
            };
            recognition.start();
        } else {
            navigate('/search');
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const renderTile = (tile) => (
        <Link key={tile.id} to={`/category/${tile.id}`} className="group flex min-w-0 flex-col items-center text-center">
            <span className="customer-category-tile-image flex aspect-square w-full items-center justify-center overflow-hidden rounded-[24px] bg-[#f1f4ff] p-2">
                {tile.image
                    ? <img src={applyCloudinaryTransform(tile.image, 'f_auto,q_auto,w_240')} alt={tile.name} loading="lazy" className="h-full w-full object-contain transition-transform group-active:scale-95" />
                    : <ShoppingBag size={32} className="text-[#5277c7]" />}
            </span>
            <span className="mt-1.5 line-clamp-2 min-h-8 text-[12px] font-medium leading-[1.2] text-[#171717]">{tile.name}</span>
        </Link>
    );

    return (
        <div className="customer-categories-page min-h-screen bg-white pb-24 font-sans">
            <header className="customer-categories-header sticky top-0 z-40 border-b border-blue-500 bg-[#2874f0]">
                <div className="flex h-14 items-center justify-between gap-3 px-4">
                    <div className="flex min-w-0 items-center gap-2">
                        <button type="button" onClick={() => navigate('/')} className="flex h-10 w-10 shrink-0 items-center justify-center text-white" aria-label="Back to home">
                            <ArrowLeft size={26} strokeWidth={2.5} />
                        </button>
                        <h1 className="truncate text-[20px] font-semibold tracking-tight text-white">All Categories</h1>
                    </div>
                    <div className="flex items-center gap-5">
                        <button type="button" onClick={() => setIsSearchOpen((open) => !open)} className="relative flex h-10 w-9 items-center justify-center text-white" aria-label="Search categories">
                            {isSearchOpen ? <X size={25} strokeWidth={2.5} /> : <Search size={25} strokeWidth={2.5} />}
                        </button>
                        <button type="button" onClick={() => navigate('/cart')} className="relative flex h-10 w-9 items-center justify-center text-white" aria-label="Open cart">
                            <ShoppingCart size={27} strokeWidth={2.5} />
                            {groceryCartCount > 0 && <span className="absolute -right-1 -top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[11px] font-bold text-white">{groceryCartCount}</span>}
                        </button>
                    </div>
                </div>
                {isSearchOpen && (
                    <div className="px-4 pb-3">
                        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                            <Search size={17} className="shrink-0 text-slate-500" />
                            <input type="text" autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={handleKeyDown} placeholder="Search categories" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                            {searchQuery
                                ? <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"><X size={16} className="text-slate-500" /></button>
                                : <button type="button" onClick={handleVoiceSearch} className={isListening ? 'animate-pulse text-blue-600' : 'text-slate-600'} aria-label="Voice search"><Mic size={17} /></button>}
                        </div>
                    </div>
                )}
            </header>

            {isLoading ? (
                <div className="flex min-h-[65vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
            ) : sections.length === 0 ? (
                <div className="flex min-h-[65vh] flex-col items-center justify-center text-center text-slate-500">
                    <ShoppingBag size={34} className="mb-3" />
                    <p className="font-semibold">No Categories Found</p>
                    <p className="mt-1 text-sm">Categories will appear here once added from the admin panel.</p>
                </div>
            ) : (
                <div className="customer-category-browser flex items-start" style={{ '--category-header-height': isSearchOpen ? '108px' : '56px' }}>
                    <aside ref={sidebarRef} className="customer-category-sidebar sticky shrink-0 overflow-y-auto bg-[#f1f2f5]" aria-label="Header categories">
                        {visibleSections.map((section) => (
                            <button key={section.id} type="button" onClick={() => selectHeader(section.id)} className={`customer-category-sidebar-item flex w-full flex-col items-center justify-center gap-1 border-b border-[#d7d9de] px-1.5 text-center ${activeSection?.id === section.id ? 'is-active' : ''}`}>
                                <span className="flex h-[38px] w-[48px] items-center justify-center overflow-hidden">
                                    {section.image
                                        ? <img src={applyCloudinaryTransform(section.image, 'f_auto,q_auto,w_120')} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                                        : <CategoryIcon iconId={section.iconId} className="h-8 w-8 text-slate-500 [&_svg]:h-full [&_svg]:w-full" />}
                                </span>
                                <span className="line-clamp-2 min-h-7 text-[10px] font-medium leading-[1.15]">{section.name}</span>
                            </button>
                        ))}
                    </aside>

                    <main ref={contentPaneRef} className="customer-category-content min-w-0 flex-1 px-3 pb-10 pt-2">
                        {activeSection && (() => {
                            const section = activeSection;
                            return (
                                <section key={section.id} className="customer-category-header-section">
                                    {currentBanner?.image ? (
                                        <div className="mb-2 overflow-hidden rounded-[22px] bg-[#e8efff] shadow-sm">
                                            {currentBanner.buttonLink && currentBanner.buttonLink !== '/'
                                                ? <Link to={currentBanner.buttonLink} className="block"><img src={applyCloudinaryTransform(currentBanner.image, 'f_auto,q_auto,w_900')} alt={currentBanner.title || `${section.name} banner`} className="customer-category-banner-image w-full object-cover" /></Link>
                                                : <img src={applyCloudinaryTransform(currentBanner.image, 'f_auto,q_auto,w_900')} alt={currentBanner.title || `${section.name} banner`} className="customer-category-banner-image w-full object-cover" />}
                                        </div>
                                    ) : (
                                        <div className="customer-category-fallback-banner mb-2 flex items-center justify-between overflow-hidden rounded-[22px] bg-[#e8efff] px-3">
                                            <div className="relative z-10 max-w-[62%]">
                                                <h2 className="text-base font-bold leading-tight text-[#171717]">{section.name}</h2>
                                                <span className="mt-2 inline-flex h-7 w-10 items-center justify-center rounded-full bg-black text-white"><ArrowRight size={17} /></span>
                                            </div>
                                            {section.image && <img src={applyCloudinaryTransform(section.image, 'f_auto,q_auto,w_240')} alt="" className="h-full max-h-[110px] w-[42%] object-contain" />}
                                        </div>
                                    )}
                                    {bannerSlides.length > 1 && (
                                        <div className="mb-3 flex items-center justify-center gap-1.5" role="tablist" aria-label={`${section.name} banners`}>
                                            {bannerSlides.map((slide, index) => (
                                                <button
                                                    key={`${slide.image}-${index}`}
                                                    type="button"
                                                    onClick={() => setActiveBannerIndex(index)}
                                                    className={`h-1.5 rounded-full transition-all ${index === activeBannerIndex ? 'w-6 bg-[#2875e8]' : 'w-2 bg-slate-300'}`}
                                                    aria-label={`Show ${section.name} banner ${index + 1}`}
                                                    aria-selected={index === activeBannerIndex}
                                                    role="tab"
                                                />
                                            ))}
                                        </div>
                                    )}
                                    <h2 className="mb-3 mt-3 flex items-center gap-1.5 text-[17px] font-semibold leading-tight tracking-tight text-[#171717]">
                                        <span>{section.name} Section</span>
                                        <ArrowRight size={19} strokeWidth={2} aria-hidden="true" />
                                    </h2>
                                    {query && section.categories.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-slate-500">No categories matching “{searchQuery}”.</div>
                                    ) : (
                                        <motion.div initial={{ opacity: 0.92, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-x-2 gap-y-3.5 pb-5">
                                            {section.categories.map(renderTile)}
                                        </motion.div>
                                    )}
                                </section>
                            );
                        })()}
                    </main>
                </div>
            )}
        </div>
    );
};

export default CategoriesPage;
