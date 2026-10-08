import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import {
    Save,
    Settings,
    Palette,
    ArrowRight,
    Globe,
    Building2,
    Share2,
    Smartphone,
    Search,
    Upload,
    Mail,
    Phone,
    MapPin,
    CreditCard,
    Facebook,
    Twitter,
    Instagram,
    Linkedin,
    Youtube,
    Loader2,
    X,
    Smile
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';
import { useSettings } from '@core/context/SettingsContext';


const AdminSettings = () => {
    const normalizeProductApprovalConfig = (raw) => {
        const config = raw?.productApproval || raw || {};
        return {
            sellerCreateRequiresApproval: Boolean(config.sellerCreateRequiresApproval),
            sellerEditRequiresApproval: Boolean(config.sellerEditRequiresApproval),
        };
    };

    const { refetch } = useSettings();
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('general');
    const [logoUploading, setLogoUploading] = useState(false);
    const [faviconUploading, setFaviconUploading] = useState(false);
    const [deliveryBadgeUploading, setDeliveryBadgeUploading] = useState(false);
    const deliveryBadgeInputRef = useRef(null);

    const handleDeliveryBadgeUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file (PNG, JPG, etc.)', 'error');
            return;
        }
        setDeliveryBadgeUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadSettingsImage(fd, 'deliverybadge');
            const url = res.data?.result?.url || res.data?.url;
            if (url) {
                handleInputChange('deliveryBadgeImage', url);
                showToast('Delivery badge image uploaded. Click Save Changes to apply.', 'success');
            } else throw new Error('No URL returned');
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.message || 'Failed to upload delivery badge image', 'error');
        } finally {
            setDeliveryBadgeUploading(false);
            e.target.value = '';
        }
    };
    const [bannerHeaderCategories, setBannerHeaderCategories] = useState([]);
    const logoInputRef = useRef(null);
    const faviconInputRef = useRef(null);

    useEffect(() => {
        if (activeTab !== 'categoriesBanner') return;
        let isCurrent = true;
        adminApi.getCategories({ type: 'header', catalogType: 'all', page: 1, limit: 100 })
            .then((res) => {
                const payload = res.data?.result || {};
                const items = Array.isArray(payload.items) ? payload.items : (res.data?.results || []);
                if (isCurrent) setBannerHeaderCategories(items.filter((item) => item.type === 'header'));
            })
            .catch((error) => console.error('Failed to load header categories for banners', error));
        return () => { isCurrent = false; };
    }, [activeTab]);

    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [emojiPickerPos, setEmojiPickerPos] = useState({ top: 0, left: 0 });
    const emojiBtnRef = useRef(null);
    const emojiPopoverRef = useRef(null);
    const emojiInputRef = useRef(null);

    /** @type {any} */
    const defaultSettings = {
        appName: '',
        supportEmail: '',
        supportPhone: '',
        currencySymbol: '₹',
        currencyCode: 'INR',
        timezone: 'Asia/Kolkata',
        logoUrl: '',
        faviconUrl: '',
        primaryColor: 'var(--primary)',
        secondaryColor: '#64748b',
        companyName: '',
        taxId: '',
        address: '',
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: '',
        youtube: '',
        playStoreLink: '',
        appStoreLink: '',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        keywords: [],
        footerMessage: 'Sab kuchh ek basket mein',
        footerEmoji: '❤️',
        returnDeliveryCommission: 0,
        lowStockAlertsEnabled: true,
        productApproval: {
            sellerCreateRequiresApproval: false,
            sellerEditRequiresApproval: false,
        },
        categoriesBanner: {
            image: '',
            presetVersion: 0,
            banners: [],
            badgeText: 'KIRANA STORE',
            title: 'Everything you need, in one place',
            buttonText: 'Shop Now',
            buttonLink: '/',
            isVisible: true,
        },
        deliveryBadgeText: '30 min',
        deliveryBadgeImage: '',
        deliveryBadgeBg: 'linear-gradient(135deg, #ff9f43 0%, #ff793f 100%)',
        deliveryBadgeEnabled: true,
        bestSellingTitle: 'Best Selling Categories',
        bestSellingCategoryIds: [],
        categoryTopDeals: {},
    };
    const [settings, setSettings] = useState(defaultSettings);

    useEffect(() => {
        if (activeTab !== 'categoriesBanner' || isLoading || bannerHeaderCategories.length === 0) return;
        setSettings((current) => {
            if (Number(current.categoriesBanner?.presetVersion || 0) >= CATEGORY_BANNER_PRESET_VERSION) return current;
            return {
                ...current,
                categoriesBanner: {
                    ...current.categoriesBanner,
                    presetVersion: CATEGORY_BANNER_PRESET_VERSION,
                    banners: getDefaultCategoryBannerItems(bannerHeaderCategories),
                },
            };
        });
    }, [activeTab, isLoading, bannerHeaderCategories]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await adminApi.getSettings();
                const data = res.data?.result ?? res.data;
                if (data) {
                    setSettings(prev => ({
                        ...prev,
                        ...data,
                        productApproval: normalizeProductApprovalConfig(data || {}),
                        keywords: Array.isArray(data.keywords) ? data.keywords : (data.metaKeywords ? data.metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : []),
                        returnDeliveryCommission: data.returnDeliveryCommission ?? 0,
                        categoriesBanner: {
                            ...prev.categoriesBanner,
                            ...(data.categoriesBanner || {}),
                        },
                    }));
                }
            } catch (error) {
                console.error("Failed to load settings", error);
                showToast('Failed to load settings', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [showToast]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const payload = {
                ...settings,
                keywords: Array.isArray(settings.keywords) ? settings.keywords : (settings.metaKeywords ? settings.metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : []),
            };
            const res = await adminApi.updateSettings(payload);
            const updatedData = res.data?.result ?? res.data;
            
            if (updatedData) {
                setSettings(prev => ({
                    ...prev,
                    ...updatedData,
                    productApproval: normalizeProductApprovalConfig(updatedData),
                }));
            }
            await refetch({ forceRefresh: true });
            showToast('Settings updated successfully', 'success');
        } catch (error) {
            console.error("Failed to update settings", error);
            showToast('Failed to update settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleProductApprovalToggle = (field) => {
        setSettings((prev) => ({
            ...prev,
            productApproval: {
                ...(prev.productApproval || {}),
                [field]: !prev.productApproval?.[field],
            },
        }));
    };
    const tabs = [
        { id: 'general', label: 'General Configuration', icon: Settings },
        { id: 'legal', label: 'Legal & Contact', icon: Building2 },
        { id: 'social', label: 'Social & Apps', icon: Share2 },
        { id: 'seo', label: 'SEO & Meta', icon: Search },
    ];

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Platform Settings
                        <div className="p-2 bg-slate-100 rounded-xl">
                            <Settings className="h-5 w-5 text-slate-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Manage global configurations, branding, and legal information.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "flex items-center gap-2 px-8 py-4 bg-black text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-200 hover:shadow-brand-300 active:scale-95 active:shadow-inner",
                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-brand-700"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {isSaving ? 'Updating...' : 'Save All Changes'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-3 space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left",
                                activeTab === tab.id
                                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            )}
                        >
                            <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-brand-600" : "text-slate-400")} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-9 space-y-6">

                    {isLoading && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-8 flex items-center justify-center">
                                <div className="h-8 w-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                            </div>
                        </Card>
                    )}

                                        {/* Callout to Admin CMS Layout & Branding */}
                    <div className="p-4 bg-gradient-to-r from-indigo-50/90 via-white to-purple-50/90 rounded-2xl border border-indigo-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                                <Palette className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-900">App Logo, 30-Min Badge & Banners</p>
                                <p className="text-[11px] text-slate-500 font-medium">Looking to customize your logo, delivery promise badge, or promotional banners? Manage them in Admin CMS.</p>
                            </div>
                        </div>
                        <Link
                            to="/admin/layout-branding"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>Open Layout & Branding</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    General Information
                                </h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Name</label>
                                    <input
                                        type="text"
                                        value={settings.appName}
                                        onChange={(e) => handleInputChange('appName', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="email"
                                            value={settings.supportEmail}
                                            onChange={(e) => handleInputChange('supportEmail', e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Phone</label>
                                    <div className="relative group">
                                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={settings.supportPhone}
                                            onChange={(e) => handleInputChange('supportPhone', e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Currency Symbol</label>
                                    <input
                                        type="text"
                                        value={settings.currencySymbol}
                                        onChange={(e) => handleInputChange('currencySymbol', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="md:col-span-2 rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Auto Low Stock Alerts</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            Automatically notify sellers when any product stock drops to its low-stock threshold.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.lowStockAlertsEnabled}
                                        onClick={() => handleInputChange('lowStockAlertsEnabled', !settings.lowStockAlertsEnabled)}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200",
                                            settings.lowStockAlertsEnabled ? "bg-emerald-500" : "bg-slate-300"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200",
                                                settings.lowStockAlertsEnabled ? "translate-x-7" : "translate-x-1"
                                            )}
                                        />
                                    </button>
                                </div>

                            </div>
                        </Card>
                    )}

                    {/* Legal Settings */}
                    {activeTab === 'legal' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    Legal Entity & Contact
                                </h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Legal Name</label>
                                        <input
                                            type="text"
                                            value={settings.companyName}
                                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tax ID / GSTIN / VAT</label>
                                        <div className="relative group">
                                            <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={settings.taxId}
                                                onChange={(e) => handleInputChange('taxId', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Office Address</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-5 top-6 h-4 w-4 text-slate-400" />
                                        <textarea
                                            rows={3}
                                            value={settings.address}
                                            onChange={(e) => handleInputChange('address', e.target.value)}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Return delivery commission input moved to Fees & Charges → Delivery Fee Settings */}
                            </div>
                        </Card>
                    )}

                    {/* Social & Apps */}
                    {activeTab === 'social' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    Social Media & App Links
                                </h3>
                            </div>
                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facebook URL</label>
                                        <div className="relative group">
                                            <Facebook className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600" />
                                            <input
                                                type="url"
                                                value={settings.facebook}
                                                onChange={(e) => handleInputChange('facebook', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Twitter / X URL</label>
                                        <div className="relative group">
                                            <Twitter className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-500" />
                                            <input
                                                type="url"
                                                value={settings.twitter}
                                                onChange={(e) => handleInputChange('twitter', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instagram URL</label>
                                        <div className="relative group">
                                            <Instagram className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-600" />
                                            <input
                                                type="url"
                                                value={settings.instagram}
                                                onChange={(e) => handleInputChange('instagram', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">YouTube URL</label>
                                        <div className="relative group">
                                            <Youtube className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-600" />
                                            <input
                                                type="url"
                                                value={settings.youtube}
                                                onChange={(e) => handleInputChange('youtube', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Play Store Link (Android)</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600" />
                                            <input
                                                type="url"
                                                value={settings.playStoreLink}
                                                onChange={(e) => handleInputChange('playStoreLink', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Store Link (iOS)</label>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-800" />
                                            <input
                                                type="url"
                                                value={settings.appStoreLink}
                                                onChange={(e) => handleInputChange('appStoreLink', e.target.value)}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* SEO Settings */}
                    {activeTab === 'seo' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    SEO & Meta Information
                                </h3>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Meta Title</label>
                                    <input
                                        type="text"
                                        value={settings.metaTitle}
                                        onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default Meta Description</label>
                                    <textarea
                                        rows={3}
                                        value={settings.metaDescription}
                                        onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all resize-none"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 italic text-right">Recommended length: 150-160 characters</p>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Keywords</label>
                                    <input
                                        type="text"
                                        value={settings.metaKeywords}
                                        onChange={(e) => handleInputChange('metaKeywords', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500/10 transition-all"
                                        placeholder="keyword1, keyword2, keyword3"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 italic text-right">Separate keywords with commas</p>
                                </div>
                            </div>
                        </Card>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AdminSettings;

