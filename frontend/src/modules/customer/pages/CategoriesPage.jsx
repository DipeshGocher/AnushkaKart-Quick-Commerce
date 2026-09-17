import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, ChevronRight, ChevronDown, ShoppingBasket, Leaf, Milk, Wheat, CookingPot, Cookie, CupSoda, UtensilsCrossed, Droplets, SprayCan, Baby, Snowflake, Sparkles, Dog, Activity, Home, Shirt, Luggage, Gift, LayoutGrid } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useSettings } from '@core/context/SettingsContext';

const CategoriesBannerCarousel = ({ banners, fallbackImage }) => {
    const scrollContainerRef = React.useRef(null);

    React.useEffect(() => {
        if (!banners || banners.length <= 1) return;

        const interval = setInterval(() => {
            if (scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const scrollLeft = container.scrollLeft;
                const clientWidth = container.clientWidth;
                const scrollWidth = container.scrollWidth;

                if (scrollLeft + clientWidth >= scrollWidth - 10) {
                    // Reach end, reset to 0
                    container.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    // Scroll to next
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
        <div className="block md:hidden w-full overflow-hidden rounded-2xl relative group">
            <div 
                ref={scrollContainerRef}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar smooth-scroll w-full"
            >
                {activeBanners.map((b, i) => (
                    <div 
                        key={i} 
                        className="flex-shrink-0 w-full snap-start"
                        onClick={() => {
                            if (b.buttonLink && b.buttonLink !== '/') {
                                // Redirect or navigate logic if necessary.
                                // For now, we will just use Link or handle it inline.
                                if (b.buttonLink.startsWith('http')) {
                                    window.location.href = b.buttonLink;
                                } else {
                                    // Use React Router navigate if needed.
                                }
                            }
                        }}
                    >
                        {b.buttonLink && b.buttonLink !== '/' ? (
                            <Link to={b.buttonLink} className="block w-full cursor-pointer">
                                <img
                                    src={b.image}
                                    alt={b.title || "Promotional Banner"}
                                    className="w-full h-auto object-contain block"
                                />
                            </Link>
                        ) : (
                            <img
                                src={b.image}
                                alt={b.title || "Promotional Banner"}
                                className="w-full h-auto object-contain block"
                            />
                        )}
                    </div>
                ))}
            </div>
            {activeBanners.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                    {activeBanners.map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/50 backdrop-blur-sm shadow-sm" />
                    ))}
                </div>
            )}
        </div>
    );
};

const CATEGORY_THEMES = [
    { bg: 'bg-[#FFF0F5]', border: 'border-pink-200/70', iconBg: 'bg-[#E91E63]', iconColor: 'text-white', arrowColor: 'text-[#E91E63]', icon: ShoppingBasket },
    { bg: 'bg-[#ECFDF5]', border: 'border-emerald-200/70', iconBg: 'bg-[#10B981]', iconColor: 'text-white', arrowColor: 'text-[#10B981]', icon: Leaf },
    { bg: 'bg-[#FDF2F8]', border: 'border-rose-200/70', iconBg: 'bg-[#D81B60]', iconColor: 'text-white', arrowColor: 'text-[#D81B60]', icon: Milk },
    { bg: 'bg-[#FFFBEB]', border: 'border-amber-200/70', iconBg: 'bg-[#F59E0B]', iconColor: 'text-white', arrowColor: 'text-[#D97706]', icon: Wheat },
    { bg: 'bg-[#FEF2F2]', border: 'border-red-200/70', iconBg: 'bg-[#EF4444]', iconColor: 'text-white', arrowColor: 'text-[#EF4444]', icon: CookingPot },
    { bg: 'bg-[#F3E8FF]', border: 'border-purple-200/70', iconBg: 'bg-[#9333EA]', iconColor: 'text-white', arrowColor: 'text-[#9333EA]', icon: Cookie },
    { bg: 'bg-[#E0F2FE]', border: 'border-cyan-200/70', iconBg: 'bg-[#06B6D4]', iconColor: 'text-white', arrowColor: 'text-[#06B6D4]', icon: CupSoda },
    { bg: 'bg-[#FFF3E0]', border: 'border-orange-200/70', iconBg: 'bg-[#FF6D00]', iconColor: 'text-white', arrowColor: 'text-[#FF6D00]', icon: UtensilsCrossed },
    { bg: 'bg-[#EEF2FF]', border: 'border-indigo-200/70', iconBg: 'bg-[#4F46E5]', iconColor: 'text-white', arrowColor: 'text-[#4F46E5]', icon: Droplets },
    { bg: 'bg-[#F7FEE7]', border: 'border-lime-200/70', iconBg: 'bg-[#84CC16]', iconColor: 'text-white', arrowColor: 'text-[#65A30D]', icon: SprayCan },
    { bg: 'bg-[#FFF0F5]', border: 'border-pink-200/70', iconBg: 'bg-[#C2185B]', iconColor: 'text-white', arrowColor: 'text-[#C2185B]', icon: Baby },
    { bg: 'bg-[#F0F9FF]', border: 'border-sky-200/70', iconBg: 'bg-[#0284C7]', iconColor: 'text-white', arrowColor: 'text-[#0284C7]', icon: Snowflake },
    { bg: 'bg-[#FAF5FF]', border: 'border-purple-200/70', iconBg: 'bg-[#A855F7]', iconColor: 'text-white', arrowColor: 'text-[#A855F7]', icon: Sparkles },
    { bg: 'bg-[#ECFDF5]', border: 'border-teal-200/70', iconBg: 'bg-[#14B8A6]', iconColor: 'text-white', arrowColor: 'text-[#14B8A6]', icon: Dog },
    { bg: 'bg-[#FFFBEB]', border: 'border-yellow-200/70', iconBg: 'bg-[#EAB308]', iconColor: 'text-white', arrowColor: 'text-[#EAB308]', icon: Activity },
];

const DEFAULT_THEME = { bg: 'bg-[#FFF0F5]', border: 'border-pink-200/70', iconBg: 'bg-[#E91E63]', iconColor: 'text-white', arrowColor: 'text-[#E91E63]', icon: LayoutGrid };

const getCategoryTheme = (index) => {
    return CATEGORY_THEMES[index % CATEGORY_THEMES.length] || DEFAULT_THEME;
};

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const { settings } = useSettings();

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            // Try tree first for better organization
            const res = await customerApi.getCategories({ tree: true });
            if (res.data.success) {
                const tree = res.data.results || res.data.result || [];
                const flatCats = [];
                tree.forEach(header => {
                    (header.children || []).forEach(cat => {
                        flatCats.push({
                            id: cat._id,
                            name: cat.name,
                            image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                            productCount: cat.productCount || 0,
                            subcategories: cat.children || [],
                            sortOrder: cat.sortOrder || 0
                        });
                    });
                });

                // Sort globally by sortOrder, then by name
                flatCats.sort((a, b) => {
                    const orderA = a.sortOrder || 0;
                    const orderB = b.sortOrder || 0;
                    if (orderA !== orderB) return orderA - orderB;
                    return a.name.localeCompare(b.name);
                });
                
                if (flatCats.length > 0) {
                    setCategories(flatCats);
                    setIsLoading(false);
                    return;
                }
            }

            // Fallback: use flat list
            const flatRes = await customerApi.getCategories();
            if (flatRes.data.success) {
                const all = flatRes.data.results || flatRes.data.result || [];
                const cats = all.filter(c => c.type === 'category');
                
                const formattedCats = cats.map(cat => ({
                    id: cat._id,
                    name: cat.name,
                    image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                    productCount: cat.productCount || 0,
                    sortOrder: cat.sortOrder || 0
                }));

                // Sort globally by sortOrder, then by name
                formattedCats.sort((a, b) => {
                    const orderA = a.sortOrder || 0;
                    const orderB = b.sortOrder || 0;
                    if (orderA !== orderB) return orderA - orderB;
                    return a.name.localeCompare(b.name);
                });

                setCategories(formattedCats);
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

    const banner = settings?.categoriesBanner || {
        image: '',
        badgeText: 'KIRANA STORE',
        title: 'Everything you need, in one place',
        buttonText: 'Shop Now',
        buttonLink: '/',
        isVisible: true,
    };

    return (
        <div className="min-h-screen bg-[#f1f4f8] pb-16 md:pt-[80px] font-sans">
            {/* Header Area */}
            <div className="sticky top-0 z-30 bg-white px-5 py-3 flex items-center justify-between border-b border-gray-100">
                <button
                    onClick={() => navigate(-1)}
                    className="p-1 -ml-1 hover:bg-slate-50 rounded-full transition-all"
                >
                    <ChevronLeft size={24} className="text-gray-900" />
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-lg font-black text-gray-900 tracking-tight leading-tight">All Categories</h1>
                    <span className="text-[11px] text-gray-500 font-medium">Find everything you need</span>
                </div>
                <button
                    onClick={() => navigate('/search')}
                    className="p-1.5 -mr-1 hover:bg-slate-50 rounded-full transition-all"
                >
                    <Search size={22} className="text-gray-900" strokeWidth={2.5} />
                </button>
            </div>

            <div className="max-w-[600px] mx-auto px-2 pt-4">
                {/* Promotional Banner - Hidden on Desktop (md:hidden), Visible only on Mobile */}
                {banner?.isVisible && (banner?.image || (banner?.banners && banner.banners.length > 0)) && (
                    <CategoriesBannerCarousel 
                        banners={banner?.banners} 
                        fallbackImage={banner?.image} 
                    />
                )}

                {/* Categories List */}
                <div className="mt-2">
                    {isLoading && (
                        <div className="space-y-4 py-4">
                            {[...Array(6)].map((_, idx) => (
                                <div key={idx} className="flex items-center justify-between py-4 px-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 h-20 bg-slate-50/50 rounded-xl animate-pulse" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-28 bg-slate-50 rounded animate-pulse" />
                                            <div className="h-3 w-16 bg-slate-50 rounded animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="h-4 w-4 bg-slate-50 rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && categories.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="text-6xl mb-4">🛒</div>
                            <h2 className="text-xl font-bold text-gray-700 mb-2">No Categories Found</h2>
                            <p className="text-gray-400 text-sm">Add categories from the admin panel to see them here.</p>
                        </div>
                    )}

                    {!isLoading && categories.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pb-8">
                            {categories.map((category, index) => {
                                const theme = getCategoryTheme(index);
                                const IconComponent = theme.icon;
                                return (
                                    <Link
                                        to={`/category/${category.id}`}
                                        key={category.id}
                                        className={`flex flex-col items-center p-2 rounded-[40px] border ${theme.border} ${theme.bg} shadow-sm transition-transform active:scale-95 h-full`}
                                    >
                                        <div className={`w-8 h-8 rounded-full ${theme.iconBg} flex items-center justify-center mb-2 z-10 -mt-1 shadow-sm flex-shrink-0`}>
                                            <IconComponent size={16} className={theme.iconColor} strokeWidth={2.5} />
                                        </div>
                                        
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 mb-2 flex items-center justify-center flex-shrink-0">
                                            <img
                                                src={applyCloudinaryTransform(category.image)}
                                                alt={category.name}
                                                loading="lazy"
                                                className="w-full h-full object-contain mix-blend-multiply scale-[1.35]"
                                            />
                                        </div>
                                        
                                        <div className="flex flex-col items-center justify-start text-center w-full px-1 flex-grow">
                                            <span className="font-bold text-[12px] leading-[1.1] text-slate-800 line-clamp-2 min-h-[26px] flex items-center justify-center">
                                                {category.name}
                                            </span>
                                            <span className="text-[10px] font-medium text-slate-500 mt-1 whitespace-nowrap">
                                                {category.productCount || 0}+ Items
                                            </span>
                                        </div>
                                        
                                        <div className="mt-2 pb-1">
                                            <ChevronDown size={14} className={theme.arrowColor} strokeWidth={3} />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoriesPage;
