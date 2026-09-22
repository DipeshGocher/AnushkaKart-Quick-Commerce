import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Mic, X, ShoppingBag, ArrowRight } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@core/context/SettingsContext';

const CategoriesBannerCarousel = ({ banners, fallbackImage }) => {
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        if (!banners || banners.length <= 1) return;

        const interval = setInterval(() => {
            if (scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const scrollLeft = container.scrollLeft;
                const clientWidth = container.clientWidth;
                const scrollWidth = container.scrollWidth;

                if (scrollLeft + clientWidth >= scrollWidth - 10) {
                    container.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    container.scrollBy({ left: clientWidth, behavior: 'smooth' });
                }
            }
        }, 3500);

        return () => clearInterval(interval);
    }, [banners]);

    const activeBanners = banners && banners.length > 0 
        ? banners 
        : fallbackImage ? [{ image: fallbackImage, buttonLink: '/' }] : [];

    if (activeBanners.length === 0) return null;

    return (
        <div className="w-full overflow-hidden rounded-2xl relative group mb-4 shadow-sm">
            <div 
                ref={scrollContainerRef}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar smooth-scroll w-full"
            >
                {activeBanners.map((b, i) => (
                    <div 
                        key={i} 
                        className="flex-shrink-0 w-full snap-start"
                    >
                        {b.buttonLink && b.buttonLink !== '/' ? (
                            <Link to={b.buttonLink} className="block w-full cursor-pointer">
                                <img
                                    src={b.image}
                                    alt={b.title || "Promotional Banner"}
                                    className="w-full h-auto max-h-[140px] sm:max-h-[180px] object-cover block"
                                />
                            </Link>
                        ) : (
                            <img
                                src={b.image}
                                alt={b.title || "Promotional Banner"}
                                className="w-full h-auto max-h-[140px] sm:max-h-[180px] object-cover block"
                            />
                        )}
                    </div>
                ))}
            </div>
            {activeBanners.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {activeBanners.map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/70 backdrop-blur-sm shadow-sm" />
                    ))}
                </div>
            )}
        </div>
    );
};

const CategoriesPage = () => {
    const [sections, setSections] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const navigate = useNavigate();
    const { settings } = useSettings();

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch hierarchical tree for grocery categories
            const res = await customerApi.getCategories({ tree: 'true', catalogType: 'grocery' });
            
            if (res.data?.success) {
                const tree = res.data.results || res.data.result || res.data.data || [];
                const parsedSections = [];

                tree.forEach((header) => {
                    const children = header.children || [];
                    const subCats = children.map((cat) => ({
                        id: cat._id || cat.id,
                        name: cat.name,
                        image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                        productCount: cat.productCount || 0,
                        sortOrder: cat.sortOrder || 0,
                        subcategories: cat.children || [],
                    }));

                    // Sort subcategories inside header by sortOrder, then by name
                    subCats.sort((a, b) => {
                        const orderA = a.sortOrder || 0;
                        const orderB = b.sortOrder || 0;
                        if (orderA !== orderB) return orderA - orderB;
                        return a.name.localeCompare(b.name);
                    });

                    if (subCats.length > 0) {
                        parsedSections.push({
                            id: header._id || header.id,
                            name: header.name,
                            sortOrder: header.sortOrder || 0,
                            categories: subCats,
                        });
                    }
                });

                // Sort headers globally by sortOrder, then by name
                parsedSections.sort((a, b) => {
                    const orderA = a.sortOrder || 0;
                    const orderB = b.sortOrder || 0;
                    if (orderA !== orderB) return orderA - orderB;
                    return a.name.localeCompare(b.name);
                });

                if (parsedSections.length > 0) {
                    setSections(parsedSections);
                    setIsLoading(false);
                    return;
                }
            }

            // Fallback: If tree didn't return headers with children, use flat list
            const flatRes = await customerApi.getCategories({ catalogType: 'grocery' });
            if (flatRes.data?.success) {
                const all = flatRes.data.results || flatRes.data.result || flatRes.data.data || [];
                const cats = all.filter((c) => c.type === 'category' || !c.type);

                const formattedCats = cats.map((cat) => ({
                    id: cat._id || cat.id,
                    name: cat.name,
                    image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                    productCount: cat.productCount || 0,
                    sortOrder: cat.sortOrder || 0,
                    subcategories: [],
                }));

                formattedCats.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));

                if (formattedCats.length > 0) {
                    setSections([
                        {
                            id: 'all-grocery',
                            name: 'Grocery',
                            categories: formattedCats,
                        }
                    ]);
                }
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    // Filter categories based on search input
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return sections;
        const query = searchQuery.toLowerCase().trim();

        return sections
            .map((section) => {
                const matchedCats = section.categories.filter((cat) => {
                    const matchName = cat.name.toLowerCase().includes(query);
                    const matchSub = cat.subcategories?.some((sub) =>
                        sub.name.toLowerCase().includes(query)
                    );
                    return matchName || matchSub;
                });

                return {
                    ...section,
                    categories: matchedCats,
                };
            })
            .filter((section) => section.categories.length > 0);
    }, [sections, searchQuery]);

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
            recognition.onresult = (e) => {
                const transcript = e.results[0][0].transcript;
                if (transcript) {
                    setSearchQuery(transcript);
                }
                setIsListening(false);
            };
            recognition.start();
        } else {
            navigate('/search');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const banner = settings?.categoriesBanner || {
        image: '',
        badgeText: 'KIRANA STORE',
        title: 'Everything you need, in one place',
        buttonText: 'Shop Now',
        buttonLink: '/',
        isVisible: true,
    };

    return (
        <div className="min-h-screen bg-white pb-24 md:pt-[76px] font-sans selection:bg-rose-100">
            {/* Top Flipkart-style Header Bar */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-3.5 sm:px-5 py-2.5 border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div className="max-w-[640px] mx-auto flex items-center gap-2.5">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 -ml-1 hover:bg-slate-100 rounded-full transition-colors active:scale-95 text-slate-800 flex-shrink-0"
                        title="Go back"
                    >
                        <ChevronLeft size={24} strokeWidth={2.4} />
                    </button>

                    {/* Flipkart-Style Search Input Bar */}
                    <div className="flex-1 relative flex items-center">
                        <div className="w-full flex items-center bg-white border-[1.5px] border-pink-400/80 rounded-full px-3.5 py-2 shadow-[0_2px_8px_rgba(244,63,94,0.08)] transition-all focus-within:border-pink-600 focus-within:ring-2 focus-within:ring-pink-100">
                            <Search size={18} className="text-pink-600 flex-shrink-0 mr-2" strokeWidth={2.5} />
                            
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search in Minutes"
                                className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none"
                            />

                            {searchQuery ? (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="p-1 text-slate-400 hover:text-slate-600 ml-1 rounded-full"
                                >
                                    <X size={16} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleVoiceSearch}
                                    className={`p-1 text-slate-800 hover:text-pink-600 transition-colors ml-1 ${isListening ? 'text-pink-600 animate-pulse' : ''}`}
                                    title="Voice search"
                                >
                                    <Mic size={18} strokeWidth={2.2} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-[640px] mx-auto px-3.5 sm:px-5 pt-3">
                {/* Promotional Banner (if configured) */}
                {banner?.isVisible && (banner?.image || (banner?.banners && banner.banners.length > 0)) && (
                    <CategoriesBannerCarousel 
                        banners={banner?.banners} 
                        fallbackImage={banner?.image} 
                    />
                )}

                {/* Loading Skeleton */}
                {isLoading && (
                    <div className="space-y-7 py-2">
                        {[1, 2, 3].map((sectionIdx) => (
                            <div key={sectionIdx} className="space-y-3">
                                <div className="h-5 w-32 bg-slate-100 rounded-md animate-pulse" />
                                <div className="grid grid-cols-4 gap-x-2.5 sm:gap-x-4 gap-y-3">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((itemIdx) => (
                                        <div key={itemIdx} className="flex flex-col items-center">
                                            <div className="w-full aspect-square rounded-[22px] bg-pink-50/50 animate-pulse" />
                                            <div className="h-3 w-14 bg-slate-100 rounded mt-2 animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty Search Results */}
                {!isLoading && filteredSections.length === 0 && searchQuery && (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 mb-3 shadow-inner">
                            <Search size={28} />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 mb-1">No categories matching "{searchQuery}"</h3>
                        <p className="text-xs text-slate-500 max-w-[260px] mb-4">
                            Try searching for something else or search all products directly.
                        </p>
                        <button
                            onClick={() => navigate(`/search?q=${encodeURIComponent(searchQuery)}`)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-600 text-white text-xs font-semibold shadow-sm hover:bg-pink-700 transition-all active:scale-95"
                        >
                            Search in Products <ArrowRight size={14} />
                        </button>
                    </div>
                )}

                {/* Empty Database State */}
                {!isLoading && sections.length === 0 && !searchQuery && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500 mb-3">
                            <ShoppingBag size={30} />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 mb-1">No Categories Found</h3>
                        <p className="text-xs text-slate-400 max-w-[240px]">
                            Grocery categories will appear here once added from the admin panel.
                        </p>
                    </div>
                )}

                {/* Flipkart-Style Categories Layout (Header sections one by one with 4-col subcategory cards) */}
                {!isLoading && filteredSections.length > 0 && (
                    <div className="space-y-6 sm:space-y-7 pt-1">
                        {filteredSections.map((section) => (
                            <div key={section.id} className="category-section">
                                {/* Section Header Title */}
                                <div className="mb-2.5 sm:mb-3 flex items-center justify-between">
                                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight capitalize">
                                        {section.name}
                                    </h2>
                                </div>

                                {/* 4-Column Grid of Subcategory Cards */}
                                <div className="grid grid-cols-4 gap-x-2.5 sm:gap-x-4 gap-y-3.5 sm:gap-y-4">
                                    {section.categories.map((category) => (
                                        <Link
                                            key={category.id}
                                            to={`/category/${category.id}`}
                                            className="group flex flex-col items-center cursor-pointer select-none"
                                        >
                                            {/* Soft Pastel Rounded Card Container */}
                                            <div className="w-full aspect-square rounded-[22px] bg-[#FAF0F5] border border-pink-100/50 p-2 sm:p-2.5 flex items-center justify-center transition-all duration-150 group-active:scale-95 group-hover:bg-[#F8EBF3] group-hover:shadow-sm">
                                                <img
                                                    src={applyCloudinaryTransform(category.image)}
                                                    alt={category.name}
                                                    loading="lazy"
                                                    className="w-full h-full object-contain mix-blend-multiply transition-transform duration-200 group-hover:scale-105 drop-shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
                                                />
                                            </div>

                                            {/* Clean Centered 2-line Label Below Card */}
                                            <span className="text-[11px] sm:text-xs font-semibold text-slate-800 text-center leading-[1.2] line-clamp-2 min-h-[28px] mt-1.5 px-0.5 group-hover:text-pink-600 transition-colors flex items-start justify-center">
                                                {category.name}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoriesPage;
