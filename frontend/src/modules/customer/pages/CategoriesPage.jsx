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
import { slugify } from '@/core/utils/productUrl';

const isAllOrForYou = (cat) => {
    if (!cat) return false;
    const name = String(cat.name || '').trim().toLowerCase();
    const slug = String(cat.slug || '').trim().toLowerCase();
    return name === 'for you' || name === 'all' || slug === 'all';
};

const CategoriesPage = () => {
    const [sections, setSections] = useState([]);
    const [forYouImage, setForYouImage] = useState(null);
    const [forYouIconId, setForYouIconId] = useState('');
    const [activeHeaderId, setActiveHeaderId] = useState('for_you');
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
                
                // Bind "For You" image and icon statically from the "All" category
                const allHeader = tree.find((h) => {
                    const slug = String(h?.slug || '').trim().toLowerCase();
                    const name = String(h?.name || '').trim().toLowerCase();
                    return slug === 'all' || name === 'all';
                });
                const forYouImg = allHeader?.image?.url || (typeof allHeader?.image === 'string' ? allHeader?.image : null);
                const forYouIcon = allHeader?.iconId || '';

                const parsed = tree
                    .filter((header) => !isAllOrForYou(header))
                    .map((header) => {
                        const hId = header._id || header.id;
                        const hName = header.name;
                        const hSlug = header.slug || slugify(hName);
                        return {
                            id: hId,
                            name: hName,
                            slug: hSlug,
                            image: header.image || '',
                            iconId: header.iconId || '',
                            sortOrder: header.sortOrder || 0,
                            categories: (header.children || []).map((category) => {
                                const cId = category._id || category.id;
                                const cName = category.name;
                                const cSlug = category.slug || slugify(cName);
                                return {
                                    id: cId,
                                    name: cName,
                                    slug: cSlug,
                                    image: category.image || category.icon || '',
                                    sortOrder: category.sortOrder || 0,
                                    headerId: hId,
                                    headerName: hName,
                                    headerSlug: hSlug,
                                    subcategories: (category.children || []).map((sub) => {
                                        const sId = sub._id || sub.id;
                                        const sName = sub.name;
                                        const sSlug = sub.slug || slugify(sName);
                                        return {
                                            id: sId,
                                            name: sName,
                                            slug: sSlug,
                                            image: sub.image || sub.icon || '',
                                            sortOrder: sub.sortOrder || 0,
                                            parentId: cId,
                                            parentName: cName,
                                            parentSlug: cSlug,
                                            headerId: hId,
                                            headerName: hName,
                                            headerSlug: hSlug,
                                        };
                                    }).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
                                };
                            }).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
                        };
                    })
                    .filter((header) => header.categories.length > 0)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

                if (isMounted) {
                    setSections(parsed);
                    setForYouImage(forYouImg);
                    setForYouIconId(forYouIcon);
                    setActiveHeaderId('for_you');
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
            categories: section.categories.filter((category) =>
                !query ||
                category.name.toLowerCase().includes(query) ||
                (category.subcategories || []).some((sub) => sub.name.toLowerCase().includes(query))
            ),
        }))
        .filter((section) => !query || section.categories.length > 0 || section.name.toLowerCase().includes(query));

    const isForYouActive = activeHeaderId === 'for_you';
    const activeSection = isForYouActive ? null : (visibleSections.find((section) => section.id === activeHeaderId) || visibleSections[0] || null);
    const activeHeaderKey = activeSection?.id || '';

    const bannerSlides = !isForYouActive && settings?.categoriesBanner?.isVisible !== false && activeSection
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
        if (activeHeaderId === 'for_you') return;
        if (activeSection && activeSection.id !== activeHeaderId) {
            setActiveHeaderId(activeSection.id);
        }
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

    const renderTile = (tile, isSubcategory = false) => {
        const headerSlug = tile.headerSlug || slugify(tile.headerName || '');
        const mainSlug = isSubcategory
            ? (tile.parentSlug || slugify(tile.parentName || ''))
            : (tile.slug || slugify(tile.name || ''));
        const subSlug = isSubcategory
            ? (tile.slug || slugify(tile.name || ''))
            : '';

        const targetUrl = isSubcategory
            ? `/category/${headerSlug}/${mainSlug}?sub=${subSlug}`
            : `/category/${headerSlug}/${mainSlug}`;

        const navState = isSubcategory
            ? {
                activeSubcategoryId: tile.id,
                subCategorySlug: subSlug,
                subCategoryName: tile.name,
                activeMainCategoryId: tile.parentId,
                mainCategorySlug: mainSlug,
                mainCategoryName: tile.parentName,
                headerSlug,
                headerName: tile.headerName,
            }
            : {
                activeMainCategoryId: tile.id,
                mainCategorySlug: mainSlug,
                mainCategoryName: tile.name,
                headerSlug,
                headerName: tile.headerName,
            };

        return (
            <Link
                key={tile.id}
                to={targetUrl}
                state={navState}
                className="group flex min-w-0 flex-col items-center text-center"
            >
                <span className="customer-category-tile-image flex h-[72px] w-[72px] aspect-square items-center justify-center overflow-hidden rounded-[20px] bg-[#f4f4f4] hover:bg-[#eaeaea] border border-[#e5e7eb] p-1.5 transition-all duration-150 group-hover:border-slate-300 group-active:scale-95 shadow-2xs">
                    {tile.image ? (
                        <img
                            src={applyCloudinaryTransform(tile.image, 'f_auto,q_auto,w_300')}
                            alt={tile.name}
                            loading="lazy"
                            className="h-full w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform"
                        />
                    ) : (
                        <ShoppingBag size={24} className="text-slate-400" />
                    )}
                </span>
                <span className="mt-1.5 line-clamp-2 min-h-[26px] max-w-[78px] text-center text-[11px] font-semibold leading-[14px] text-[#0a2540] group-hover:text-primary tracking-tight">
                    {tile.name}
                </span>
            </Link>
        );
    };

    return (
        <div className="customer-categories-page min-h-screen bg-white pb-24 font-sans">
            {/* ── 1. Seamless White Header (No border or shadow, mixing into page) ── */}
            <header className="customer-categories-header sticky top-0 z-40 bg-white">
                <div className="flex h-14 items-center justify-between gap-3 px-4">
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="flex h-10 w-10 shrink-0 items-center justify-center text-[#111827] active:bg-slate-100 rounded-full transition-colors"
                            aria-label="Back to home"
                        >
                            <ArrowLeft size={24} strokeWidth={2.5} />
                        </button>
                        <h1 className="truncate text-[20px] font-bold tracking-tight text-[#111827]">
                            All Categories
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setIsSearchOpen((open) => !open)}
                            className="relative flex h-10 w-9 items-center justify-center text-[#111827] active:bg-slate-100 rounded-full transition-colors"
                            aria-label="Search categories"
                        >
                            {isSearchOpen ? <X size={24} strokeWidth={2.2} /> : <Search size={24} strokeWidth={2.2} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/cart')}
                            className="relative flex h-10 w-9 items-center justify-center text-[#111827] active:bg-slate-100 rounded-full transition-colors"
                            aria-label="Open cart"
                        >
                            <ShoppingCart size={24} strokeWidth={2.2} />
                            {groceryCartCount > 0 && (
                                <span className="absolute -right-1.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10.5px] font-bold text-white shadow-2xs">
                                    {groceryCartCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
                {isSearchOpen && (
                    <div className="px-4 pb-3 bg-white">
                        <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 shadow-2xs">
                            <Search size={17} className="shrink-0 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search categories"
                                className="min-w-0 flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-slate-400"
                            />
                            {searchQuery
                                ? <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search"><X size={16} className="text-slate-500" /></button>
                                : <button type="button" onClick={handleVoiceSearch} className={isListening ? 'animate-pulse text-blue-600' : 'text-slate-600'} aria-label="Voice search"><Mic size={17} /></button>}
                        </div>
                    </div>
                )}
            </header>

            {isLoading ? (
                <div className="flex min-h-[65vh] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
            ) : sections.length === 0 ? (
                <div className="flex min-h-[65vh] flex-col items-center justify-center text-center text-slate-500">
                    <ShoppingBag size={34} className="mb-3" />
                    <p className="font-semibold">No Categories Found</p>
                    <p className="mt-1 text-sm">Categories will appear here once added from the admin panel.</p>
                </div>
            ) : (
                <div className="customer-category-browser flex items-start" style={{ '--category-header-height': isSearchOpen ? '108px' : '56px' }}>
                    {/* ── 2. Sidebar: Header Categories vertically centered between upper & lower borders ── */}
                    <aside ref={sidebarRef} className="customer-category-sidebar sticky shrink-0 overflow-y-auto bg-[#f1f2f5]" aria-label="Header categories">
                        {/* For You Sidebar Button */}
                        <button
                            type="button"
                            onClick={() => selectHeader('for_you')}
                            className={`customer-category-sidebar-item flex w-full flex-col items-center justify-center gap-1 border-b border-[#e2e4e8] px-1 text-center ${isForYouActive ? 'is-active' : ''}`}
                        >
                            <span className="flex h-[36px] w-[44px] items-center justify-center shrink-0 overflow-hidden">
                                {forYouImage ? (
                                    <img
                                        src={applyCloudinaryTransform(forYouImage, 'f_auto,q_auto,w_120')}
                                        alt="For You"
                                        className="max-h-full max-w-full object-contain"
                                        loading="lazy"
                                    />
                                ) : forYouIconId ? (
                                    <CategoryIcon
                                        iconId={forYouIconId}
                                        className="h-7 w-7 text-slate-500 [&_svg]:h-full [&_svg]:w-full"
                                    />
                                ) : (
                                    <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-b from-[#a855f7] to-[#7c3aed] text-white shadow-xs">
                                        <ShoppingBag size={20} className="fill-white/20 text-white" />
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-500 text-[8.5px] font-bold text-white shadow-2xs">%</span>
                                    </div>
                                )}
                            </span>
                            <span className="line-clamp-2 text-[10px] font-medium leading-[12px] text-center max-w-[70px] break-words">For You</span>
                        </button>

                        {/* Other Header Categories */}
                        {visibleSections.map((section) => (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => selectHeader(section.id)}
                                className={`customer-category-sidebar-item flex w-full flex-col items-center justify-center gap-1 border-b border-[#e2e4e8] px-1 text-center ${activeHeaderId === section.id ? 'is-active' : ''}`}
                            >
                                <span className="flex h-[36px] w-[44px] items-center justify-center shrink-0 overflow-hidden">
                                    {section.image ? (
                                        <img
                                            src={applyCloudinaryTransform(section.image, 'f_auto,q_auto,w_120')}
                                            alt=""
                                            className="max-h-full max-w-full object-contain"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <CategoryIcon
                                            iconId={section.iconId}
                                            className="h-7 w-7 text-slate-500 [&_svg]:h-full [&_svg]:w-full"
                                        />
                                    )}
                                </span>
                                <span className="line-clamp-2 text-[10px] font-medium leading-[12px] text-center max-w-[70px] break-words">{section.name}</span>
                            </button>
                        ))}
                    </aside>

                    {/* ── 3. Content Pane ── */}
                    <main ref={contentPaneRef} className="customer-category-content min-w-0 flex-1 px-3.5 pb-12 pt-3 sm:px-5">
                        {isForYouActive ? (
                            /* FOR YOU VIEW: Each Header Category's name as heading, followed by its main categories in 3 columns */
                            <motion.div initial={{ opacity: 0.92, y: 6 }} animate={{ opacity: 1, y: 0 }} className="pb-8">
                                {visibleSections.map((header) => {
                                    if (!header.categories || header.categories.length === 0) return null;
                                    return (
                                        <div key={header.id} className="mb-6">
                                            <h2 className="mb-3 text-[15px] font-bold tracking-tight text-[#171717]">
                                                {header.name}
                                            </h2>
                                            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5">
                                                {header.categories.map((cat) => renderTile(cat))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        ) : activeSection ? (
                            /* SPECIFIC HEADER CATEGORY VIEW: Banner -> Main Categories -> Separation -> Subcategories */
                            (() => {
                                const section = activeSection;
                                const allSubcategories = (section.categories || []).flatMap((cat) => cat.subcategories || []);
                                return (
                                    <motion.div initial={{ opacity: 0.92, y: 6 }} animate={{ opacity: 1, y: 0 }} key={section.id} className="customer-category-header-section pb-8">
                                        {/* Banner Slide */}
                                        {currentBanner?.image ? (
                                            <div className="mb-3 overflow-hidden rounded-[22px] bg-[#e8efff] shadow-2xs">
                                                {currentBanner.buttonLink && currentBanner.buttonLink !== '/' ? (
                                                    <Link to={currentBanner.buttonLink} className="block">
                                                        <img
                                                            src={applyCloudinaryTransform(currentBanner.image, 'f_auto,q_auto,w_900')}
                                                            alt={currentBanner.title || `${section.name} banner`}
                                                            className="customer-category-banner-image w-full object-cover"
                                                        />
                                                    </Link>
                                                ) : (
                                                    <img
                                                        src={applyCloudinaryTransform(currentBanner.image, 'f_auto,q_auto,w_900')}
                                                        alt={currentBanner.title || `${section.name} banner`}
                                                        className="customer-category-banner-image w-full object-cover"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="customer-category-fallback-banner mb-3 flex items-center justify-between overflow-hidden rounded-[22px] bg-[#e8efff] px-3">
                                                <div className="relative z-10 max-w-[62%]">
                                                    <h2 className="text-base font-bold leading-tight text-[#171717]">{section.name}</h2>
                                                    <span className="mt-2 inline-flex h-7 w-10 items-center justify-center rounded-full bg-black text-white">
                                                        <ArrowRight size={17} />
                                                    </span>
                                                </div>
                                                {section.image && (
                                                    <img
                                                        src={applyCloudinaryTransform(section.image, 'f_auto,q_auto,w_240')}
                                                        alt=""
                                                        className="h-full max-h-[110px] w-[42%] object-contain"
                                                    />
                                                )}
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

                                        {/* Main Categories (NO header text below banner, directly in 3 columns) */}
                                        {query && section.categories.length === 0 ? (
                                            <div className="py-6 text-center text-xs text-slate-500">No categories matching “{searchQuery}”.</div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5">
                                                {section.categories.map((cat) => renderTile(cat))}
                                            </div>
                                        )}

                                        {/* Separation Divider & All Subcategories (in 3 columns) */}
                                        {allSubcategories.length > 0 && (
                                            <>
                                                <div className="my-5 flex items-center gap-3">
                                                    <div className="h-px flex-1 bg-slate-200" />
                                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sub Categories</span>
                                                    <div className="h-px flex-1 bg-slate-200" />
                                                </div>

                                                <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:gap-x-4 sm:gap-y-5 pb-6">
                                                    {allSubcategories.map((sub) => renderTile(sub, true))}
                                                </div>
                                            </>
                                        )}
                                    </motion.div>
                                );
                            })()
                        ) : null}
                    </main>
                </div>
            )}
        </div>
    );
};

export default CategoriesPage;
