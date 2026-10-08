import React, { useState, useEffect, useRef } from 'react';
import Card from '@shared/components/ui/Card';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { useSettings } from '@core/context/SettingsContext';
import { adminApi } from '../services/adminApi';
import {
    Palette,
    Upload,
    X,
    Loader2,
    Save,
    Smile,
    Plus,
    Trash2,
    Sparkles,
    Image as ImageIcon,
    Clock,
    Zap,
    MapPin,
    Search,
    ChevronDown,
    Layers,
    Globe,
    PanelsTopLeft,
    Link as LinkIcon,
    Phone,
    Mail,
    Facebook,
    Twitter,
    Instagram,
    Youtube,
    Linkedin,
    ExternalLink,
    RefreshCw,
    Eye
} from 'lucide-react';

const COMMON_EMOJIS = [
    '❤️', '✨', '🔥', '🎉', '🛒', '⚡', '🌟', '🚀', '💯', '🛍️',
    '😍', '👍', '🙏', '🌿', '🍎', '🍰', '☕', '🎁', '🎈', '🏆'
];

const FOOTER_BG_PRESETS = [
    { name: "Default Brand Dark (Screenshot)", val: "" },
    { name: "Midnight Charcoal", val: "#0f172a" },
    { name: "Deep Royal Navy", val: "linear-gradient(135deg, #020617 0%, #1e3a8a 100%)" },
    { name: "Emerald Luxe Dark", val: "linear-gradient(135deg, #051108 0%, #064e3b 100%)" },
    { name: "Neon Velvet Indigo", val: "linear-gradient(135deg, #18002e 0%, #311042 100%)" },
    { name: "Pure Obsidian Black", val: "#000000" },
];

const DEFAULT_QUICK_LINKS = [
    { label: 'Home', url: '/' },
    { label: 'About Us', url: '/about' },
    { label: 'Shop Products', url: '/products' },
    { label: 'Special Offers', url: '/offers' },
    { label: 'Contact & Help', url: '/support' },
];

const DEFAULT_CATEGORIES_LINKS = [
    { label: 'All Categories', url: '/categories' },
    { label: 'Groceries & Daily Essentials', url: '/category/Grocery' },
    { label: 'Fashion & Apparel', url: '/category/Fashion' },
    { label: 'Electronics & Gadgets', url: '/category/Electronics' },
    { label: 'Home & Kitchen Appliances', url: '/category/Home%20Appliances' },
];

const BADGE_BG_PRESETS = [
    { name: "Orange Gradient", val: "linear-gradient(135deg, #ff9f43 0%, #ff793f 100%)" },
    { name: "Electric Blue", val: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" },
    { name: "Emerald Green", val: "linear-gradient(135deg, #10b981 0%, #059669 100%)" },
    { name: "Neon Purple", val: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" },
    { name: "Sunset Gold", val: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" },
    { name: "Midnight Dark", val: "#0f172a" },
];

export default function LayoutBranding() {
    const { showToast } = useToast();
    const { refetch: refetchSettings } = useSettings() || {};
    const [activeTab, setActiveTab] = useState('branding');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Header categories for category banners
    const [headerCategories, setHeaderCategories] = useState([]);

    // File input refs
    const logoInputRef = useRef(null);
    const faviconInputRef = useRef(null);
    const deliveryBadgeInputRef = useRef(null);
    const bannerFileInputRef = useRef(null);
    const currentUploadIndexRef = useRef(null);

    // Upload states
    const [logoUploading, setLogoUploading] = useState(false);
    const [faviconUploading, setFaviconUploading] = useState(false);
    const [deliveryBadgeUploading, setDeliveryBadgeUploading] = useState(false);
    const [bannerUploadingIndex, setBannerUploadingIndex] = useState(null);

    // Emoji picker states
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const emojiBtnRef = useRef(null);
    const emojiInputRef = useRef(null);

    // Settings state
    const [settings, setSettings] = useState({
        appName: 'Anushka Store',
        logoUrl: '',
        faviconUrl: '',
        primaryColor: '#FF6B00',
        secondaryColor: '#1A1A1A',
        footerMessage: 'Sab kuchh ek basket mein',
        footerEmoji: '❤️',
        deliveryBadgeText: '30 min',
        deliveryBadgeImage: '',
        deliveryBadgeBg: 'linear-gradient(135deg, #ff9f43 0%, #ff793f 100%)',
        deliveryBadgeEnabled: true,
        categoriesBanner: {
            isVisible: true,
            banners: []
        },
        // Footer Customization
        footerDescription: 'Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.',
        footerQuickLinksTitle: 'Quick Links',
        footerQuickLinks: DEFAULT_QUICK_LINKS,
        footerCategoriesTitle: 'Categories',
        footerCategoriesLinks: DEFAULT_CATEGORIES_LINKS,
        footerContactTitle: 'Contact Us',
        address: 'Corporate House, RNT Marg',
        supportPhone: '+91 98765 43210',
        supportEmail: 'support@appzeto.com',
        facebook: '',
        twitter: '',
        instagram: '',
        youtube: '',
        linkedin: '',
        footerCopyright: '',
        footerPrivacyUrl: '/privacy',
        footerTermsUrl: '/support',
        footerBgColor: '',
        footerEnabled: true
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch settings
                const res = await adminApi.getSettings();
                const data = res.data?.result || res.data || {};
                setSettings(prev => ({
                    ...prev,
                    appName: data.appName ?? prev.appName,
                    logoUrl: data.logoUrl ?? prev.logoUrl,
                    faviconUrl: data.faviconUrl ?? prev.faviconUrl,
                    primaryColor: data.primaryColor ?? prev.primaryColor,
                    secondaryColor: data.secondaryColor ?? prev.secondaryColor,
                    footerMessage: data.footerMessage ?? prev.footerMessage,
                    footerEmoji: data.footerEmoji ?? prev.footerEmoji,
                    deliveryBadgeText: data.deliveryBadgeText ?? prev.deliveryBadgeText,
                    deliveryBadgeImage: data.deliveryBadgeImage ?? prev.deliveryBadgeImage,
                    deliveryBadgeBg: data.deliveryBadgeBg ?? prev.deliveryBadgeBg,
                    deliveryBadgeEnabled: data.deliveryBadgeEnabled !== undefined ? data.deliveryBadgeEnabled : prev.deliveryBadgeEnabled,
                    categoriesBanner: {
                        isVisible: data.categoriesBanner?.isVisible !== undefined ? data.categoriesBanner.isVisible : true,
                        banners: Array.isArray(data.categoriesBanner?.banners) ? data.categoriesBanner.banners : []
                    },
                    footerDescription: data.footerDescription ?? prev.footerDescription,
                    footerQuickLinksTitle: data.footerQuickLinksTitle ?? prev.footerQuickLinksTitle,
                    footerQuickLinks: Array.isArray(data.footerQuickLinks) && data.footerQuickLinks.length > 0 ? data.footerQuickLinks : prev.footerQuickLinks,
                    footerCategoriesTitle: data.footerCategoriesTitle ?? prev.footerCategoriesTitle,
                    footerCategoriesLinks: Array.isArray(data.footerCategoriesLinks) && data.footerCategoriesLinks.length > 0 ? data.footerCategoriesLinks : prev.footerCategoriesLinks,
                    footerContactTitle: data.footerContactTitle ?? prev.footerContactTitle,
                    address: data.address ?? prev.address,
                    supportPhone: data.supportPhone ?? prev.supportPhone,
                    supportEmail: data.supportEmail ?? prev.supportEmail,
                    facebook: data.facebook ?? prev.facebook,
                    twitter: data.twitter ?? prev.twitter,
                    instagram: data.instagram ?? prev.instagram,
                    youtube: data.youtube ?? prev.youtube,
                    linkedin: data.linkedin ?? prev.linkedin,
                    footerCopyright: data.footerCopyright ?? prev.footerCopyright,
                    footerPrivacyUrl: data.footerPrivacyUrl ?? prev.footerPrivacyUrl,
                    footerTermsUrl: data.footerTermsUrl ?? prev.footerTermsUrl,
                    footerBgColor: data.footerBgColor ?? prev.footerBgColor,
                    footerEnabled: data.footerEnabled !== undefined ? data.footerEnabled : prev.footerEnabled
                }));

                // 2. Fetch header categories
                const catRes = await adminApi.getCategories({ type: 'header', limit: 100 });
                if (catRes.data?.success) {
                    const list = catRes.data?.result?.items || catRes.data?.results || [];
                    setHeaderCategories(list);
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to load layout & branding settings', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    const handleInputChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Upload Handlers
    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadSettingsImage(fd, 'logo');
            const url = res.data?.result?.url || res.data?.url;
            if (url) {
                handleInputChange('logoUrl', url);
                showToast('Logo uploaded successfully', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to upload logo', 'error');
        } finally {
            setLogoUploading(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const handleFaviconUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFaviconUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadSettingsImage(fd, 'favicon');
            const url = res.data?.result?.url || res.data?.url;
            if (url) {
                handleInputChange('faviconUrl', url);
                showToast('Favicon uploaded successfully', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to upload favicon', 'error');
        } finally {
            setFaviconUploading(false);
            if (faviconInputRef.current) faviconInputRef.current.value = '';
        }
    };

    const handleDeliveryBadgeUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setDeliveryBadgeUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadSettingsImage(fd, 'deliverybadge');
            const url = res.data?.result?.url || res.data?.url;
            if (url) {
                handleInputChange('deliveryBadgeImage', url);
                showToast('Badge icon uploaded successfully', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to upload badge icon', 'error');
        } finally {
            setDeliveryBadgeUploading(false);
            if (deliveryBadgeInputRef.current) deliveryBadgeInputRef.current.value = '';
        }
    };

    // Category Banners Handlers
    const handleBannerChange = (field, value) => {
        setSettings(prev => ({
            ...prev,
            categoriesBanner: {
                ...(prev.categoriesBanner || {}),
                [field]: value
            }
        }));
    };

    const handleBannerItemChange = (index, field, value) => {
        setSettings(prev => {
            const currentBanners = [...(prev.categoriesBanner?.banners || [])];
            currentBanners[index] = { ...currentBanners[index], [field]: value };
            return {
                ...prev,
                categoriesBanner: {
                    ...(prev.categoriesBanner || {}),
                    banners: currentBanners
                }
            };
        });
    };

    const addBanner = () => {
        setSettings(prev => ({
            ...prev,
            categoriesBanner: {
                ...(prev.categoriesBanner || {}),
                banners: [
                    ...(prev.categoriesBanner?.banners || []),
                    {
                        image: '',
                        headerCategoryId: headerCategories[0]?._id || '',
                        badgeText: 'PROMOTION',
                        title: '',
                        buttonText: 'Shop Now',
                        buttonLink: '/'
                    }
                ]
            }
        }));
    };

    const removeBanner = (index) => {
        setSettings(prev => ({
            ...prev,
            categoriesBanner: {
                ...(prev.categoriesBanner || {}),
                banners: (prev.categoriesBanner?.banners || []).filter((_, i) => i !== index)
            }
        }));
    };

    const triggerBannerUpload = (index) => {
        currentUploadIndexRef.current = index;
        bannerFileInputRef.current?.click();
    };

    const handleBannerUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const index = currentUploadIndexRef.current;
        if (index === null || index === undefined) return;

        setBannerUploadingIndex(index);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadSettingsImage(fd, 'categoriesbanner');
            const url = res.data?.result?.url || res.data?.url;
            if (url) {
                handleBannerItemChange(index, 'image', url);
                showToast('Banner image uploaded successfully', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to upload banner image', 'error');
        } finally {
            setBannerUploadingIndex(null);
            e.target.value = '';
        }
    };

    // Save All
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                appName: settings.appName,
                logoUrl: settings.logoUrl,
                faviconUrl: settings.faviconUrl,
                primaryColor: settings.primaryColor,
                secondaryColor: settings.secondaryColor,
                footerMessage: settings.footerMessage,
                footerEmoji: settings.footerEmoji,
                deliveryBadgeText: settings.deliveryBadgeText,
                deliveryBadgeImage: settings.deliveryBadgeImage,
                deliveryBadgeBg: settings.deliveryBadgeBg,
                deliveryBadgeEnabled: settings.deliveryBadgeEnabled,
                categoriesBanner: settings.categoriesBanner,
                footerDescription: settings.footerDescription,
                footerQuickLinksTitle: settings.footerQuickLinksTitle,
                footerQuickLinks: settings.footerQuickLinks,
                footerCategoriesTitle: settings.footerCategoriesTitle,
                footerCategoriesLinks: settings.footerCategoriesLinks,
                footerContactTitle: settings.footerContactTitle,
                address: settings.address,
                supportPhone: settings.supportPhone,
                supportEmail: settings.supportEmail,
                facebook: settings.facebook,
                twitter: settings.twitter,
                instagram: settings.instagram,
                youtube: settings.youtube,
                linkedin: settings.linkedin,
                footerCopyright: settings.footerCopyright,
                footerPrivacyUrl: settings.footerPrivacyUrl,
                footerTermsUrl: settings.footerTermsUrl,
                footerBgColor: settings.footerBgColor,
                footerEnabled: settings.footerEnabled
            };

            await adminApi.updateSettings(payload);
            if (refetchSettings) {
                await refetchSettings({ forceRefresh: true });
            }
            showToast('Layout & branding settings saved successfully!', 'success');
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'Failed to save settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };


    // Footer Link Handlers
    const handleQuickLinkChange = (index, field, value) => {
        setSettings(prev => {
            const list = [...(prev.footerQuickLinks || [])];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, footerQuickLinks: list };
        });
    };

    const handleAddQuickLink = () => {
        setSettings(prev => ({
            ...prev,
            footerQuickLinks: [...(prev.footerQuickLinks || []), { label: '', url: '/' }]
        }));
    };

    const handleRemoveQuickLink = (index) => {
        setSettings(prev => ({
            ...prev,
            footerQuickLinks: (prev.footerQuickLinks || []).filter((_, i) => i !== index)
        }));
    };

    const handleResetQuickLinks = () => {
        setSettings(prev => ({
            ...prev,
            footerQuickLinks: DEFAULT_QUICK_LINKS
        }));
        showToast('Reset quick links to defaults', 'info');
    };

    const handleCategoryLinkChange = (index, field, value) => {
        setSettings(prev => {
            const list = [...(prev.footerCategoriesLinks || [])];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, footerCategoriesLinks: list };
        });
    };

    const handleAddCategoryLink = () => {
        setSettings(prev => ({
            ...prev,
            footerCategoriesLinks: [...(prev.footerCategoriesLinks || []), { label: '', url: '/categories' }]
        }));
    };

    const handleRemoveCategoryLink = (index) => {
        setSettings(prev => ({
            ...prev,
            footerCategoriesLinks: (prev.footerCategoriesLinks || []).filter((_, i) => i !== index)
        }));
    };

    const handleAutoPopulateCategories = () => {
        if (!headerCategories || headerCategories.length === 0) {
            showToast('No header categories found to import', 'info');
            return;
        }
        const generated = [
            { label: 'All Categories', url: '/categories' },
            ...headerCategories.map(cat => ({
                label: cat.name || cat.title || 'Category',
                url: `/category/${encodeURIComponent(cat.name || cat.title || '')}`
            }))
        ];
        setSettings(prev => ({
            ...prev,
            footerCategoriesLinks: generated
        }));
        showToast(`Imported ${headerCategories.length} categories into footer!`, 'success');
    };

    const handleResetCategories = () => {
        setSettings(prev => ({
            ...prev,
            footerCategoriesLinks: DEFAULT_CATEGORIES_LINKS
        }));
        showToast('Reset categories links to defaults', 'info');
    };

    const tabs = [
        { id: 'branding', label: 'Brand & Logos', icon: Palette, count: null },
        { id: 'deliveryBadge', label: '30-Min Delivery Badge', icon: Clock, count: settings.deliveryBadgeEnabled ? 'ON' : 'OFF' },
        { id: 'categoriesBanner', label: 'Category Promotional Banners', icon: ImageIcon, count: settings.categoriesBanner?.banners?.length || 0 },
        { id: 'footer', label: 'Footer Customization', icon: PanelsTopLeft, count: settings.footerEnabled ? 'Active' : 'Off' },
    ];

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                    <p className="text-sm font-semibold text-slate-500">Loading Layout & Branding Studio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-16">
            {/* Hidden File Inputs */}
            <input type="file" ref={logoInputRef} accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <input type="file" ref={faviconInputRef} accept="image/*" className="hidden" onChange={handleFaviconUpload} />
            <input type="file" ref={deliveryBadgeInputRef} accept="image/*" className="hidden" onChange={handleDeliveryBadgeUpload} />
            <input type="file" ref={bannerFileInputRef} accept="image/*" className="hidden" onChange={handleBannerUpload} />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Palette className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                Layout & Branding Studio
                            </h1>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Centralized CMS hub for App Logo, 30-Min Delivery Badge, Promotional Banners, and Brand Themes.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer",
                            isSaving && "opacity-70 cursor-wait"
                        )}
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSaving ? 'Saving Changes...' : 'Save All Changes'}
                    </button>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/60 max-w-fit">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                isActive
                                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/40"
                            )}
                        >
                            <Icon className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-400")} />
                            <span>{tab.label}</span>
                            {tab.count !== null && (
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                                    isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-600"
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: BRANDING & LOGOS */}
            {activeTab === 'branding' && (
                <div className="space-y-6">
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div>
                            <h2 className="text-base font-black text-slate-900">App Logos & Visual Identity</h2>
                            <p className="text-xs text-slate-500">Configure logo and favicon shown across customer and seller portals.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* App Logo */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                    <span>App Logo</span>
                                    <span className="text-[10px] text-slate-400 font-semibold normal-case">Recommended: 512 × 512 px</span>
                                </label>
                                <div
                                    onClick={() => !logoUploading && logoInputRef.current?.click()}
                                    className={cn(
                                        "h-44 w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group overflow-hidden cursor-pointer",
                                        settings.logoUrl ? "border-slate-200 bg-slate-50/50" : "border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/10"
                                    )}
                                >
                                    {logoUploading ? (
                                        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                    ) : settings.logoUrl ? (
                                        <>
                                            <img src={settings.logoUrl} alt="App logo" className="max-h-24 max-w-[80%] object-contain" />
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Click to change</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleInputChange('logoUrl', ''); }}
                                                    className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                                                    title="Remove logo"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Upload className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-600">Click to upload App Logo</span>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="url"
                                    value={settings.logoUrl}
                                    onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                                    placeholder="Or paste direct image URL"
                                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            {/* Favicon */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                    <span>Browser Favicon</span>
                                    <span className="text-[10px] text-slate-400 font-semibold normal-case">Recommended: 192 × 192 px</span>
                                </label>
                                <div
                                    onClick={() => !faviconUploading && faviconInputRef.current?.click()}
                                    className={cn(
                                        "h-44 w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all group overflow-hidden cursor-pointer",
                                        settings.faviconUrl ? "border-slate-200 bg-slate-50/50" : "border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/10"
                                    )}
                                >
                                    {faviconUploading ? (
                                        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                                    ) : settings.faviconUrl ? (
                                        <>
                                            <img src={settings.faviconUrl} alt="Favicon" className="max-h-16 max-w-[80%] object-contain" />
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Click to change</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleInputChange('faviconUrl', ''); }}
                                                    className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors"
                                                    title="Remove favicon"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Upload className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-600">Click to upload Favicon</span>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="url"
                                    value={settings.faviconUrl}
                                    onChange={(e) => handleInputChange('faviconUrl', e.target.value)}
                                    placeholder="Or paste direct favicon URL"
                                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        </div>

                        {/* App Name & Colors */}
                        <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Application Name</label>
                                <input
                                    type="text"
                                    value={settings.appName}
                                    onChange={(e) => handleInputChange('appName', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Anushka Store"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Primary Theme Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={settings.primaryColor}
                                        onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                                        className="h-11 w-14 rounded-xl cursor-pointer bg-transparent border-0"
                                    />
                                    <input
                                        type="text"
                                        value={settings.primaryColor}
                                        onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Secondary Theme Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={settings.secondaryColor}
                                        onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                                        className="h-11 w-14 rounded-xl cursor-pointer bg-transparent border-0"
                                    />
                                    <input
                                        type="text"
                                        value={settings.secondaryColor}
                                        onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer Message & Emoji */}
                        <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Customer Footer Tagline</label>
                                <input
                                    type="text"
                                    value={settings.footerMessage}
                                    onChange={(e) => handleInputChange('footerMessage', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none"
                                    placeholder="Sab kuchh ek basket mein"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Footer Emoji</label>
                                    <div className="flex items-center gap-1">
                                        {COMMON_EMOJIS.slice(0, 6).map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => handleInputChange('footerEmoji', emoji)}
                                                className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-sm cursor-pointer"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={settings.footerEmoji}
                                    onChange={(e) => handleInputChange('footerEmoji', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none"
                                    placeholder="❤️"
                                />
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* TAB 2: 30-MIN DELIVERY BADGE */}
            {activeTab === 'deliveryBadge' && (
                <div className="space-y-6">
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-black text-slate-900">30-Min Fast Delivery Header Badge</h2>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                                        Customer Header Div
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Customize the speed delivery badge shown right next to the user address in the top header.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-600">
                                    {settings.deliveryBadgeEnabled ? 'Visible in Header' : 'Hidden'}
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={settings.deliveryBadgeEnabled}
                                    onClick={() => handleInputChange('deliveryBadgeEnabled', !settings.deliveryBadgeEnabled)}
                                    className={cn(
                                        "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 cursor-pointer",
                                        settings.deliveryBadgeEnabled ? "bg-emerald-500" : "bg-slate-300"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                            settings.deliveryBadgeEnabled ? "translate-x-7" : "translate-x-1"
                                        )}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            {/* Configuration Fields */}
                            <div className="lg:col-span-7 space-y-5">
                                {/* Badge Text */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                        Badge Text (Delivery Promise)
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.deliveryBadgeText}
                                        onChange={(e) => handleInputChange('deliveryBadgeText', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder="E.g. 30 min, 15 min, Express"
                                    />
                                    <p className="text-[11px] text-slate-400">Examples: "30 min", "10-15 mins", "Express", "Same Day"</p>
                                </div>

                                {/* Badge Icon / Image */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                        Custom Badge Icon / Logo (Optional)
                                    </label>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => !deliveryBadgeUploading && deliveryBadgeInputRef.current?.click()}
                                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                                        >
                                            {deliveryBadgeUploading ? <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> : <Upload className="h-4 w-4" />}
                                            {settings.deliveryBadgeImage ? 'Replace Icon / Logo' : 'Upload Icon / Logo'}
                                        </button>
                                        {settings.deliveryBadgeImage && (
                                            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                                <img
                                                    src={settings.deliveryBadgeImage}
                                                    alt="Current Badge Icon"
                                                    className="h-6 w-6 object-contain bg-white rounded p-0.5 border border-slate-200"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleInputChange('deliveryBadgeImage', '');
                                                        if (deliveryBadgeInputRef.current) deliveryBadgeInputRef.current.value = '';
                                                    }}
                                                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
                                                    title="Remove Custom Badge Icon"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Remove Icon
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        type="url"
                                        value={settings.deliveryBadgeImage}
                                        onChange={(e) => handleInputChange('deliveryBadgeImage', e.target.value)}
                                        placeholder="Or paste direct icon image URL (leave empty to use default lightning icon)"
                                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                    />
                                </div>

                                {/* Background Presets & Custom Gradient */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                        Background Color / Gradient
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {BADGE_BG_PRESETS.map((preset) => (
                                            <button
                                                key={preset.name}
                                                type="button"
                                                onClick={() => handleInputChange('deliveryBadgeBg', preset.val)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5",
                                                    settings.deliveryBadgeBg === preset.val ? "ring-2 ring-indigo-600 scale-105" : "hover:opacity-90"
                                                )}
                                                style={{ background: preset.val }}
                                            >
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={settings.deliveryBadgeBg}
                                        onChange={(e) => handleInputChange('deliveryBadgeBg', e.target.value)}
                                        className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                        placeholder="CSS background gradient or hex (e.g. linear-gradient(...) or #ff793f)"
                                    />
                                </div>
                            </div>

                            {/* Header Live Preview Simulator */}
                            <div className="lg:col-span-5 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                                        Customer Header Live Preview
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">Desktop / Mobile View</span>
                                </div>

                                {/* Simulated Customer Header Bar */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        {/* Address Pill */}
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600 shrink-0">
                                                <MapPin className="h-4 w-4" />
                                            </div>
                                            <div className="truncate">
                                                <p className="text-[11px] font-black text-slate-800 leading-tight">Home • Sector 14</p>
                                                <p className="text-[10px] text-slate-400 truncate">Near City Mall, Jaipur...</p>
                                            </div>
                                        </div>

                                        {/* The 30 min badge */}
                                        {settings.deliveryBadgeEnabled !== false ? (
                                            <div
                                                className="px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-white font-black text-xs shadow-sm shrink-0 transition-all select-none animate-in fade-in"
                                                style={{ background: settings.deliveryBadgeBg || 'linear-gradient(135deg, #ff9f43 0%, #ff793f 100%)' }}
                                            >
                                                {settings.deliveryBadgeImage ? (
                                                    <img src={settings.deliveryBadgeImage} alt="Badge" className="h-4 w-4 object-contain" />
                                                ) : (
                                                    <Zap className="h-3.5 w-3.5 fill-current" />
                                                )}
                                                <span>{settings.deliveryBadgeText || '30 min'}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-semibold text-slate-400 italic">
                                                (Badge is Hidden)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p className="text-[11px] text-slate-400 text-center">
                                    Changes update here in real-time. Click <strong>Save All Changes</strong> above to publish to live store.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* TAB 3: CATEGORY PROMOTIONAL BANNERS */}
            {activeTab === 'categoriesBanner' && (
                <div className="space-y-6">
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-base font-black text-slate-900">Categories Promotional Banners</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Category specific promotional banner strips displayed when customers switch header categories (Grocery, Electronics, etc.).
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-600">
                                        {settings.categoriesBanner?.isVisible ? 'Visible to Users' : 'Hidden'}
                                    </span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.categoriesBanner?.isVisible}
                                        onClick={() => handleBannerChange('isVisible', !settings.categoriesBanner?.isVisible)}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 cursor-pointer",
                                            settings.categoriesBanner?.isVisible ? "bg-emerald-500" : "bg-slate-300"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                                settings.categoriesBanner?.isVisible ? "translate-x-7" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={addBanner}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Banner
                                </button>
                            </div>
                        </div>

                        {/* List of Category Banners */}
                        <div className="space-y-6">
                            {(settings.categoriesBanner?.banners || []).length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No Category Banners Added</p>
                                    <p className="text-xs text-slate-400 mt-1">Add banners to promote offers on specific category pages.</p>
                                    <button
                                        type="button"
                                        onClick={addBanner}
                                        className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add First Banner
                                    </button>
                                </div>
                            ) : (
                                (settings.categoriesBanner?.banners || []).map((banner, index) => (
                                    <div
                                        key={index}
                                        className="p-6 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-4 relative group"
                                    >
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                                                Banner #{index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeBanner(index)}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                title="Delete Banner"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                            {/* Banner Image Preview / Upload */}
                                            <div className="md:col-span-5 space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                                    <span>Banner Image</span>
                                                    <span className="text-[10px] text-slate-400 normal-case font-semibold">Recommended: 600 × 180 px</span>
                                                </label>
                                                <div
                                                    onClick={() => triggerBannerUpload(index)}
                                                    className={cn(
                                                        "h-32 w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all overflow-hidden cursor-pointer bg-white",
                                                        banner.image ? "border-slate-200" : "border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/10"
                                                    )}
                                                >
                                                    {bannerUploadingIndex === index ? (
                                                        <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                                                    ) : banner.image ? (
                                                        <img src={banner.image} alt={`Banner ${index + 1}`} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <>
                                                            <Upload className="h-5 w-5 text-slate-400" />
                                                            <span className="text-xs font-bold text-slate-400">Click to upload banner</span>
                                                        </>
                                                    )}
                                                </div>
                                                <input
                                                    type="url"
                                                    value={banner.image || ''}
                                                    onChange={(e) => handleBannerItemChange(index, 'image', e.target.value)}
                                                    placeholder="Or paste direct image URL"
                                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                                                />
                                            </div>

                                            {/* Target Category & Link */}
                                            <div className="md:col-span-7 space-y-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Target Header Category
                                                    </label>
                                                    <select
                                                        value={banner.headerCategoryId || ''}
                                                        onChange={(e) => handleBannerItemChange(index, 'headerCategoryId', e.target.value)}
                                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                                                    >
                                                        <option value="">Select Category (Appears on this category view)</option>
                                                        {headerCategories.map((cat) => (
                                                            <option key={cat._id || cat.id} value={cat._id || cat.id}>
                                                                {cat.name} ({cat.slug})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Banner Click URL / Deep Link
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={banner.buttonLink || ''}
                                                        onChange={(e) => handleBannerItemChange(index, 'buttonLink', e.target.value)}
                                                        placeholder="e.g. /category/... or /offers or /grocery"
                                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}
            {/* TAB 4: FOOTER CUSTOMIZATION */}
            {activeTab === 'footer' && (
                <div className="space-y-6">
                    {/* Live Preview Header Card */}
                    <Card className="p-6 md:p-8 bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/10 rounded-xl text-brand-400">
                                    <Eye className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white flex items-center gap-2">
                                        Live Footer Preview
                                        <span className={cn(
                                            "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                                            settings.footerEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                        )}>
                                            {settings.footerEnabled ? "Visible on Customer App" : "Disabled / Hidden"}
                                        </span>
                                    </h2>
                                    <p className="text-xs text-slate-400">This is how your footer will appear at the bottom of the customer website.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all border border-white/10">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(settings.footerEnabled)}
                                        onChange={(e) => handleInputChange('footerEnabled', e.target.checked)}
                                        className="h-4 w-4 rounded accent-brand-500 cursor-pointer"
                                    />
                                    <span>Show Footer in Store</span>
                                </label>
                            </div>
                        </div>

                        {/* Interactive Mini Mockup */}
                        <div
                            className="p-6 md:p-8 rounded-xl border border-white/10 transition-all text-slate-200"
                            style={settings.footerBgColor ? { background: settings.footerBgColor } : { background: 'linear-gradient(to bottom right, #051108, #0a2512, #041c0e)' }}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
                                {/* Brand Preview */}
                                <div className="space-y-3">
                                    <img
                                        src={settings.logoUrl || '/logo.png'}
                                        alt="Logo"
                                        className="h-9 w-auto object-contain"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <p className="text-[11px] leading-relaxed text-slate-300 line-clamp-3">
                                        {settings.footerDescription || 'Your daily dose of fresh, organic, and healthy products delivered straight to your door.'}
                                    </p>
                                    <div className="flex gap-2 text-slate-400 pt-1">
                                        {settings.facebook && <span className="p-1.5 bg-white/10 rounded-full"><Facebook size={12} /></span>}
                                        {settings.twitter && <span className="p-1.5 bg-white/10 rounded-full"><Twitter size={12} /></span>}
                                        {settings.instagram && <span className="p-1.5 bg-white/10 rounded-full"><Instagram size={12} /></span>}
                                        {settings.youtube && <span className="p-1.5 bg-white/10 rounded-full"><Youtube size={12} /></span>}
                                    </div>
                                </div>

                                {/* Quick Links Preview */}
                                <div className="space-y-2">
                                    <div className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="h-1 w-3 bg-brand-500 rounded"></span>
                                        {settings.footerQuickLinksTitle || 'Quick Links'}
                                    </div>
                                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                                        {(settings.footerQuickLinks || []).slice(0, 5).map((l, i) => (
                                            <li key={i} className="hover:text-white transition-colors">{l.label || 'Link'}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Categories Preview */}
                                <div className="space-y-2">
                                    <div className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="h-1 w-3 bg-brand-500 rounded"></span>
                                        {settings.footerCategoriesTitle || 'Categories'}
                                    </div>
                                    <ul className="space-y-1.5 text-[11px] text-slate-300">
                                        {(settings.footerCategoriesLinks || []).slice(0, 5).map((l, i) => (
                                            <li key={i} className="hover:text-white transition-colors">{l.label || 'Category'}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Contact Preview */}
                                <div className="space-y-2">
                                    <div className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="h-1 w-3 bg-brand-500 rounded"></span>
                                        {settings.footerContactTitle || 'Contact Us'}
                                    </div>
                                    <div className="space-y-1.5 text-[11px] text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={12} className="text-brand-400 shrink-0" />
                                            <span className="truncate">{settings.address || 'Corporate House, RNT Marg'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone size={12} className="text-brand-400 shrink-0" />
                                            <span>{settings.supportPhone || '+91 98765 43210'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail size={12} className="text-brand-400 shrink-0" />
                                            <span className="truncate">{settings.supportEmail || 'support@anushkastore.com'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom bar preview */}
                            <div className="mt-6 pt-4 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-400 gap-2">
                                <div>
                                    {settings.footerCopyright
                                        ? settings.footerCopyright.replace('{year}', new Date().getFullYear())
                                        : `© ${new Date().getFullYear()} ${settings.appName || 'AnushkaStore'}. All rights reserved.`}
                                </div>
                                <div className="flex gap-4">
                                    <span>Privacy Policy</span>
                                    <span>Terms of Service</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Column 1: Brand & Social Links */}
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div className="border-b border-slate-100 pb-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <span>Column 1: Brand Info & Social Networks</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Customize the tagline/description displayed under the app logo and social links.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Footer Brand Tagline / Description</label>
                                <textarea
                                    rows={3}
                                    value={settings.footerDescription || ''}
                                    onChange={(e) => handleInputChange('footerDescription', e.target.value)}
                                    placeholder="Your daily dose of fresh, organic, and healthy products..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                        <Facebook size={14} className="text-blue-600" /> Facebook URL
                                    </label>
                                    <input
                                        type="url"
                                        value={settings.facebook || ''}
                                        onChange={(e) => handleInputChange('facebook', e.target.value)}
                                        placeholder="https://facebook.com/yourpage"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                        <Instagram size={14} className="text-pink-600" /> Instagram URL
                                    </label>
                                    <input
                                        type="url"
                                        value={settings.instagram || ''}
                                        onChange={(e) => handleInputChange('instagram', e.target.value)}
                                        placeholder="https://instagram.com/yourprofile"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                        <Twitter size={14} className="text-sky-500" /> Twitter / X URL
                                    </label>
                                    <input
                                        type="url"
                                        value={settings.twitter || ''}
                                        onChange={(e) => handleInputChange('twitter', e.target.value)}
                                        placeholder="https://x.com/yourhandle"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                        <Youtube size={14} className="text-red-600" /> YouTube Channel
                                    </label>
                                    <input
                                        type="url"
                                        value={settings.youtube || ''}
                                        onChange={(e) => handleInputChange('youtube', e.target.value)}
                                        placeholder="https://youtube.com/@yourchannel"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                        <Linkedin size={14} className="text-blue-700" /> LinkedIn URL
                                    </label>
                                    <input
                                        type="url"
                                        value={settings.linkedin || ''}
                                        onChange={(e) => handleInputChange('linkedin', e.target.value)}
                                        placeholder="https://linkedin.com/company/yourpage"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Column 2: Quick Links */}
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Column 2: Quick Links</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Manage the navigation links displayed in the Quick Links column.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleResetQuickLinks}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                    <RefreshCw size={13} /> Reset Defaults
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddQuickLink}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                    <Plus size={14} /> Add Link
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="max-w-xs space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Column Title</label>
                                <input
                                    type="text"
                                    value={settings.footerQuickLinksTitle || 'Quick Links'}
                                    onChange={(e) => handleInputChange('footerQuickLinksTitle', e.target.value)}
                                    placeholder="Quick Links"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2 pt-2">
                                {(settings.footerQuickLinks || []).map((link, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 group">
                                        <div className="w-6 text-center text-xs font-bold text-slate-400">{idx + 1}</div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                value={link.label || ''}
                                                onChange={(e) => handleQuickLinkChange(idx, 'label', e.target.value)}
                                                placeholder="Link Text (e.g. Home)"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={link.url || ''}
                                                onChange={(e) => handleQuickLinkChange(idx, 'url', e.target.value)}
                                                placeholder="Target URL (e.g. / or /products)"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveQuickLink(idx)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="Delete Link"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Column 3: Category Links */}
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Column 3: Category Links</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Showcase popular categories or auto-sync directly from your active Header Categories.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleAutoPopulateCategories}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                    title="Auto-fill with all categories from your store"
                                >
                                    <Sparkles size={14} /> Auto-Sync From Header Categories
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetCategories}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                    <RefreshCw size={13} /> Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddCategoryLink}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                    <Plus size={14} /> Add Category Link
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="max-w-xs space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Column Title</label>
                                <input
                                    type="text"
                                    value={settings.footerCategoriesTitle || 'Categories'}
                                    onChange={(e) => handleInputChange('footerCategoriesTitle', e.target.value)}
                                    placeholder="Categories"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2 pt-2">
                                {(settings.footerCategoriesLinks || []).map((link, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 group">
                                        <div className="w-6 text-center text-xs font-bold text-slate-400">{idx + 1}</div>
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <input
                                                type="text"
                                                value={link.label || ''}
                                                onChange={(e) => handleCategoryLinkChange(idx, 'label', e.target.value)}
                                                placeholder="Category Name (e.g. Fashion & Apparel)"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={link.url || ''}
                                                onChange={(e) => handleCategoryLinkChange(idx, 'url', e.target.value)}
                                                placeholder="Category URL (e.g. /category/Fashion)"
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCategoryLink(idx)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="Delete Link"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Column 4: Contact Us */}
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div className="border-b border-slate-100 pb-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Column 4: Contact & Help Info</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Displayed with icons on the right side of the customer footer.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="max-w-xs space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Column Title</label>
                                <input
                                    type="text"
                                    value={settings.footerContactTitle || 'Contact Us'}
                                    onChange={(e) => handleInputChange('footerContactTitle', e.target.value)}
                                    placeholder="Contact Us"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <MapPin size={14} className="text-indigo-600" /> Physical Address
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.address || ''}
                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                        placeholder="Corporate House, RNT Marg"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Phone size={14} className="text-indigo-600" /> Support Phone
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.supportPhone || ''}
                                        onChange={(e) => handleInputChange('supportPhone', e.target.value)}
                                        placeholder="+91 98765 43210"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                        <Mail size={14} className="text-indigo-600" /> Support Email
                                    </label>
                                    <input
                                        type="email"
                                        value={settings.supportEmail || ''}
                                        onChange={(e) => handleInputChange('supportEmail', e.target.value)}
                                        placeholder="support@yourbrand.com"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Bottom Bar & Background Styling */}
                    <Card className="p-6 md:p-8 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-6">
                        <div className="border-b border-slate-100 pb-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Bottom Bar & Theme Styling</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Customize copyright text, legal pages, and footer background styling.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5 md:col-span-1">
                                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                    <span>Copyright Notice</span>
                                    <span className="text-[10px] text-slate-400 font-semibold">Tip: use {"{year}"} for current year</span>
                                </label>
                                <input
                                    type="text"
                                    value={settings.footerCopyright || ''}
                                    onChange={(e) => handleInputChange('footerCopyright', e.target.value)}
                                    placeholder="© {year} Anushka Store. All rights reserved."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Privacy Policy Link URL</label>
                                <input
                                    type="text"
                                    value={settings.footerPrivacyUrl || '/privacy'}
                                    onChange={(e) => handleInputChange('footerPrivacyUrl', e.target.value)}
                                    placeholder="/privacy"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">Terms of Service Link URL</label>
                                <input
                                    type="text"
                                    value={settings.footerTermsUrl || '/support'}
                                    onChange={(e) => handleInputChange('footerTermsUrl', e.target.value)}
                                    placeholder="/support"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                />
                            </div>
                        </div>

                        {/* Theme Presets */}
                        <div className="pt-4 border-t border-slate-100 space-y-3">
                            <label className="text-xs font-bold text-slate-700 block">Footer Background Styling</label>
                            
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                {FOOTER_BG_PRESETS.map((preset, pIdx) => {
                                    const isSelected = (settings.footerBgColor || '') === preset.val;
                                    return (
                                        <button
                                            key={pIdx}
                                            type="button"
                                            onClick={() => handleInputChange('footerBgColor', preset.val)}
                                            className={cn(
                                                "p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all cursor-pointer relative overflow-hidden group",
                                                isSelected ? "border-indigo-600 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300"
                                            )}
                                            style={preset.val ? { background: preset.val } : { background: 'linear-gradient(to bottom right, #051108, #0a2512, #041c0e)' }}
                                        >
                                            <span className="text-[10px] font-bold text-white drop-shadow-sm">{preset.name}</span>
                                            {isSelected && (
                                                <span className="text-[9px] font-black uppercase text-white bg-black/40 px-1.5 py-0.5 rounded self-start">
                                                    Active
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-[11px] font-semibold text-slate-500">Custom CSS Background / Gradient (optional)</label>
                                <input
                                    type="text"
                                    value={settings.footerBgColor || ''}
                                    onChange={(e) => handleInputChange('footerBgColor', e.target.value)}
                                    placeholder="e.g. #0f172a or linear-gradient(135deg, #1e3a8a, #0f172a)"
                                    className="w-full max-w-md px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                                />
                            </div>
                        </div>
                    </Card>
                </div>
            )}

        </div>
    );
}
