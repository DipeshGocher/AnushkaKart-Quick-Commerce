import React, { useEffect, useState } from 'react';
import Card from '@shared/components/ui/Card';
import {
    Save,
    Settings,
    Building2,
    Share2,
    Smartphone,
    Search,
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
    Lock,
    AlertCircle,
    CheckCircle2,
    MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';
import { useSettings } from '@core/context/SettingsContext';

const isValidEmail = (email) => {
    if (!email || !email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const isValidUrl = (url) => {
    if (!url || !url.trim()) return true;
    try {
        const withProtocol = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
        const parsed = new URL(withProtocol);
        return Boolean(parsed.hostname && parsed.hostname.includes('.'));
    } catch {
        return false;
    }
};

const normalizeUrl = (url) => {
    if (!url || !url.trim()) return '';
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return `https://${trimmed}`;
    }
    return trimmed;
};

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

    /** @type {any} */
    const defaultSettings = {
        appName: '',
        supportEmail: '',
        supportPhone: '',
        whatsappNumber: '8209224481',
        currencySymbol: '₹',
        currencyCode: 'INR',
        timezone: 'Asia/Kolkata',
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
        lowStockAlertsEnabled: true,
        productApproval: {
            sellerCreateRequiresApproval: false,
            sellerEditRequiresApproval: false,
        },
    };
    const [settings, setSettings] = useState(defaultSettings);

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
        // Validation checks
        const appName = (settings.appName || '').trim();
        if (!appName || appName.length < 2) {
            showToast('App Name is required (minimum 2 characters)', 'error');
            setActiveTab('general');
            return;
        }

        const supportEmail = (settings.supportEmail || '').trim();
        if (supportEmail && !isValidEmail(supportEmail)) {
            showToast('Please enter a valid support email address (e.g. support@example.com)', 'error');
            setActiveTab('general');
            return;
        }

        const supportPhone = (settings.supportPhone || '').trim();
        if (supportPhone && supportPhone.length !== 10) {
            showToast('Support Phone must be exactly 10 digits', 'error');
            setActiveTab('general');
            return;
        }

        const whatsappNumber = (settings.whatsappNumber || '').trim();
        if (whatsappNumber && whatsappNumber.length !== 10) {
            showToast('WhatsApp Number must be exactly 10 digits', 'error');
            setActiveTab('general');
            return;
        }

        const taxId = (settings.taxId || '').trim();
        if (taxId && taxId.length !== 15) {
            showToast('Tax ID / GSTIN must be exactly 15 alphanumeric characters', 'error');
            setActiveTab('legal');
            return;
        }

        const urlChecks = [
            { field: 'facebook', label: 'Facebook URL' },
            { field: 'twitter', label: 'Twitter / X URL' },
            { field: 'instagram', label: 'Instagram URL' },
            { field: 'youtube', label: 'YouTube URL' },
            { field: 'linkedin', label: 'LinkedIn URL' },
            { field: 'playStoreLink', label: 'Play Store Link' },
            { field: 'appStoreLink', label: 'App Store Link' },
        ];
        for (const item of urlChecks) {
            const val = (settings[item.field] || '').trim();
            if (val && !isValidUrl(val)) {
                showToast(`Please enter a valid URL for ${item.label}`, 'error');
                setActiveTab('social');
                return;
            }
        }

        try {
            setIsSaving(true);
            const payload = {
                ...settings,
                appName,
                supportEmail,
                supportPhone,
                whatsappNumber,
                currencySymbol: '₹',
                currencyCode: 'INR',
                taxId,
                facebook: normalizeUrl(settings.facebook),
                twitter: normalizeUrl(settings.twitter),
                instagram: normalizeUrl(settings.instagram),
                youtube: normalizeUrl(settings.youtube),
                linkedin: normalizeUrl(settings.linkedin),
                playStoreLink: normalizeUrl(settings.playStoreLink),
                appStoreLink: normalizeUrl(settings.appStoreLink),
                keywords: Array.isArray(settings.keywords) ? settings.keywords : (settings.metaKeywords ? settings.metaKeywords.split(',').map(k => k.trim()).filter(Boolean) : []),
            };
            const res = await adminApi.updateSettings(payload);
            const updatedData = res.data?.result ?? res.data;
            
            if (updatedData) {
                setSettings(prev => ({
                    ...prev,
                    ...updatedData,
                    currencySymbol: '₹',
                    currencyCode: 'INR',
                    productApproval: normalizeProductApprovalConfig(updatedData),
                }));
            }
            await refetch({ forceRefresh: true });
            showToast('Settings updated successfully', 'success');
        } catch (error) {
            console.error("Failed to update settings", error);
            showToast(error.response?.data?.message || 'Failed to update settings', 'error');
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

                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    General Information
                                </h3>
                            </div>
                            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* App Name */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            App Name <span className="text-red-500">*</span>
                                        </label>
                                        <span className={cn(
                                            "text-[10px] font-bold",
                                            !settings.appName?.trim() ? "text-red-500 font-extrabold" : "text-slate-400"
                                        )}>
                                            {(settings.appName || '').length}/50
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={50}
                                        value={settings.appName}
                                        onChange={(e) => handleInputChange('appName', e.target.value)}
                                        placeholder="e.g. Anushka Store"
                                        className={cn(
                                            "w-full px-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                            !settings.appName?.trim()
                                                ? "border-red-300 focus:border-red-500 focus:bg-white"
                                                : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                        )}
                                    />
                                    {!settings.appName?.trim() && (
                                        <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                                            <AlertCircle size={12} /> App Name is required
                                        </p>
                                    )}
                                </div>

                                {/* Support Email */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Support Email
                                        </label>
                                        {settings.supportEmail && !isValidEmail(settings.supportEmail) ? (
                                            <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                                                <AlertCircle size={10} /> Invalid format
                                            </span>
                                        ) : settings.supportEmail ? (
                                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 size={10} /> Valid email
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-medium text-slate-400">Optional</span>
                                        )}
                                    </div>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="email"
                                            maxLength={100}
                                            value={settings.supportEmail}
                                            onChange={(e) => handleInputChange('supportEmail', e.target.value.trim())}
                                            placeholder="support@yourbrand.com"
                                            className={cn(
                                                "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                settings.supportEmail && !isValidEmail(settings.supportEmail)
                                                    ? "border-red-300 focus:border-red-500 focus:bg-white"
                                                    : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                    {settings.supportEmail && !isValidEmail(settings.supportEmail) && (
                                        <p className="text-[11px] font-bold text-red-500">
                                            Please enter a valid email address (e.g. support@example.com)
                                        </p>
                                    )}
                                </div>

                                {/* Support Phone */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Support Phone (10 Digits)
                                        </label>
                                        <span className={cn(
                                            "text-[10px] font-bold",
                                            !settings.supportPhone ? "text-slate-400" :
                                            settings.supportPhone.length === 10 ? "text-emerald-600 font-extrabold flex items-center gap-1" : "text-amber-600 flex items-center gap-1"
                                        )}>
                                            {settings.supportPhone && settings.supportPhone.length === 10 && <CheckCircle2 size={10} />}
                                            {settings.supportPhone && settings.supportPhone.length < 10 && <AlertCircle size={10} />}
                                            {settings.supportPhone ? `${settings.supportPhone.length}/10 digits` : '10 digits required'}
                                        </span>
                                    </div>
                                    <div className="relative group">
                                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <span className="absolute left-11 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 border-r border-slate-300 pr-2">
                                            +91
                                        </span>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            maxLength={10}
                                            value={settings.supportPhone || ''}
                                            onChange={(e) => {
                                                // Strictly digits only, max 10 chars
                                                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                handleInputChange('supportPhone', digitsOnly);
                                            }}
                                            placeholder="9876543210"
                                            className={cn(
                                                "w-full pl-22 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all tracking-wider",
                                                settings.supportPhone && settings.supportPhone.length > 0 && settings.supportPhone.length < 10
                                                    ? "border-amber-300 focus:border-amber-500 focus:bg-white"
                                                    : settings.supportPhone && settings.supportPhone.length === 10
                                                    ? "border-emerald-300 focus:border-emerald-500 focus:bg-white"
                                                    : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                    {settings.supportPhone && settings.supportPhone.length > 0 && settings.supportPhone.length < 10 && (
                                        <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                            <AlertCircle size={12} /> Please enter complete 10-digit mobile number ({10 - settings.supportPhone.length} digits left)
                                        </p>
                                    )}
                                </div>

                                {/* WhatsApp Number for EMI Deep Linking */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <MessageCircle size={12} className="text-emerald-600" />
                                            WhatsApp Number (10 Digits - EMI Deep Link)
                                        </label>
                                        <span className={cn(
                                            "text-[10px] font-bold",
                                            !settings.whatsappNumber ? "text-slate-400" :
                                            settings.whatsappNumber.length === 10 ? "text-emerald-600 font-extrabold flex items-center gap-1" : "text-amber-600 flex items-center gap-1"
                                        )}>
                                            {settings.whatsappNumber && settings.whatsappNumber.length === 10 && <CheckCircle2 size={10} />}
                                            {settings.whatsappNumber && settings.whatsappNumber.length < 10 && <AlertCircle size={10} />}
                                            {settings.whatsappNumber ? `${settings.whatsappNumber.length}/10 digits` : '10 digits required'}
                                        </span>
                                    </div>
                                    <div className="relative group">
                                        <MessageCircle className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                                        <span className="absolute left-11 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 border-r border-slate-300 pr-2">
                                            +91
                                        </span>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            maxLength={10}
                                            value={settings.whatsappNumber || ''}
                                            onChange={(e) => {
                                                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                handleInputChange('whatsappNumber', digitsOnly);
                                            }}
                                            placeholder="8209224481"
                                            className={cn(
                                                "w-full pl-22 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all tracking-wider",
                                                settings.whatsappNumber && settings.whatsappNumber.length > 0 && settings.whatsappNumber.length < 10
                                                    ? "border-amber-300 focus:border-amber-500 focus:bg-white"
                                                    : settings.whatsappNumber && settings.whatsappNumber.length === 10
                                                    ? "border-emerald-300 focus:border-emerald-500 focus:bg-white"
                                                    : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        Used for customer No Cost EMI deep linking ("Contact on WhatsApp for EMI") to directly chat with admin.
                                    </p>
                                    {settings.whatsappNumber && settings.whatsappNumber.length > 0 && settings.whatsappNumber.length < 10 && (
                                        <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                            <AlertCircle size={12} /> Please enter complete 10-digit WhatsApp number ({10 - settings.whatsappNumber.length} digits left)
                                        </p>
                                    )}
                                </div>

                                {/* Currency Symbol - LOCKED */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Currency Symbol
                                        </label>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-200/80 text-slate-700 border border-slate-300">
                                            <Lock size={10} /> Locked to INR (₹)
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            readOnly
                                            disabled
                                            value="₹ (Indian Rupee - INR)"
                                            className="w-full px-5 py-4 bg-slate-100/80 border border-slate-200 rounded-2xl text-sm font-extrabold text-slate-600 cursor-not-allowed select-none outline-none shadow-inner"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <Lock className="h-4 w-4 text-slate-400" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-medium text-slate-400">
                                        System currency is fixed to Indian Rupee (₹) and cannot be changed.
                                    </p>
                                </div>

                                {/* Auto Low Stock Alerts */}
                                <div className="md:col-span-2 rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Auto Low Stock Alerts</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            Automatically notify sellers & admin when product stock reaches threshold level.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={settings.lowStockAlertsEnabled}
                                        onClick={() => handleInputChange('lowStockAlertsEnabled', !settings.lowStockAlertsEnabled)}
                                        className={cn(
                                            "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 cursor-pointer",
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
                            <div className="p-8 grid grid-cols-1 gap-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Company Legal Name */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                Company Legal Name
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {(settings.companyName || '').length}/100
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            maxLength={100}
                                            value={settings.companyName || ''}
                                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                                            placeholder="e.g. Anushka Retail Private Limited"
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/40 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Tax ID / GSTIN */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                Tax ID / GSTIN / VAT
                                            </label>
                                            <span className={cn(
                                                "text-[10px] font-bold",
                                                !settings.taxId ? "text-slate-400" :
                                                settings.taxId.length === 15 ? "text-emerald-600 font-extrabold flex items-center gap-1" : "text-amber-600 flex items-center gap-1"
                                            )}>
                                                {settings.taxId && settings.taxId.length === 15 && <CheckCircle2 size={10} />}
                                                {settings.taxId && settings.taxId.length !== 15 && <AlertCircle size={10} />}
                                                {settings.taxId ? `${settings.taxId.length}/15 chars` : '15 chars (e.g. 23AAAAA0000A1Z5)'}
                                            </span>
                                        </div>
                                        <div className="relative group">
                                            <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                maxLength={15}
                                                value={settings.taxId || ''}
                                                onChange={(e) => {
                                                    // Uppercase alphanumeric only, max 15 chars
                                                    const cleanGSTIN = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                                                    handleInputChange('taxId', cleanGSTIN);
                                                }}
                                                placeholder="23AAAAA0000A1Z5"
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all tracking-wider uppercase",
                                                    settings.taxId && settings.taxId.length > 0 && settings.taxId.length !== 15
                                                        ? "border-amber-300 focus:border-amber-500 focus:bg-white"
                                                        : settings.taxId && settings.taxId.length === 15
                                                        ? "border-emerald-300 focus:border-emerald-500 focus:bg-white"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                        {settings.taxId && settings.taxId.length > 0 && settings.taxId.length !== 15 && (
                                            <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                                <AlertCircle size={12} /> GSTIN should be 15 alphanumeric characters ({15 - settings.taxId.length} remaining)
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Registered Office Address */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Registered Office Address
                                        </label>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {(settings.address || '').length}/250
                                        </span>
                                    </div>
                                    <div className="relative group">
                                        <MapPin className="absolute left-5 top-6 h-4 w-4 text-slate-400" />
                                        <textarea
                                            rows={3}
                                            maxLength={250}
                                            value={settings.address || ''}
                                            onChange={(e) => handleInputChange('address', e.target.value)}
                                            placeholder="Corporate House, Plot No. 12, RNT Marg, Indore, MP - 452001"
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/40 focus:bg-white transition-all resize-none"
                                        />
                                    </div>
                                </div>
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Facebook */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Facebook URL</label>
                                            {settings.facebook && !isValidUrl(settings.facebook) && (
                                                <span className="text-[10px] font-bold text-red-500">Invalid URL</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Facebook className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600" />
                                            <input
                                                type="url"
                                                maxLength={300}
                                                value={settings.facebook || ''}
                                                onChange={(e) => handleInputChange('facebook', e.target.value)}
                                                onBlur={(e) => handleInputChange('facebook', normalizeUrl(e.target.value))}
                                                placeholder="https://facebook.com/yourpage"
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                    settings.facebook && !isValidUrl(settings.facebook)
                                                        ? "border-red-300 focus:border-red-500"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Twitter / X */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Twitter / X URL</label>
                                            {settings.twitter && !isValidUrl(settings.twitter) && (
                                                <span className="text-[10px] font-bold text-red-500">Invalid URL</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Twitter className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-500" />
                                            <input
                                                type="url"
                                                maxLength={300}
                                                value={settings.twitter || ''}
                                                onChange={(e) => handleInputChange('twitter', e.target.value)}
                                                onBlur={(e) => handleInputChange('twitter', normalizeUrl(e.target.value))}
                                                placeholder="https://x.com/yourhandle"
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                    settings.twitter && !isValidUrl(settings.twitter)
                                                        ? "border-red-300 focus:border-red-500"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Instagram */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Instagram URL</label>
                                            {settings.instagram && !isValidUrl(settings.instagram) && (
                                                <span className="text-[10px] font-bold text-red-500">Invalid URL</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Instagram className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-600" />
                                            <input
                                                type="url"
                                                maxLength={300}
                                                value={settings.instagram || ''}
                                                onChange={(e) => handleInputChange('instagram', e.target.value)}
                                                onBlur={(e) => handleInputChange('instagram', normalizeUrl(e.target.value))}
                                                placeholder="https://instagram.com/yourprofile"
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                    settings.instagram && !isValidUrl(settings.instagram)
                                                        ? "border-red-300 focus:border-red-500"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* YouTube */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">YouTube URL</label>
                                            {settings.youtube && !isValidUrl(settings.youtube) && (
                                                <span className="text-[10px] font-bold text-red-500">Invalid URL</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Youtube className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-600" />
                                            <input
                                                type="url"
                                                maxLength={300}
                                                value={settings.youtube || ''}
                                                onChange={(e) => handleInputChange('youtube', e.target.value)}
                                                onBlur={(e) => handleInputChange('youtube', normalizeUrl(e.target.value))}
                                                placeholder="https://youtube.com/@yourchannel"
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                    settings.youtube && !isValidUrl(settings.youtube)
                                                        ? "border-red-300 focus:border-red-500"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* LinkedIn */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">LinkedIn URL</label>
                                            {settings.linkedin && !isValidUrl(settings.linkedin) && (
                                                <span className="text-[10px] font-bold text-red-500">Invalid URL</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Linkedin className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-700" />
                                            <input
                                                type="url"
                                                maxLength={300}
                                                value={settings.linkedin || ''}
                                                onChange={(e) => handleInputChange('linkedin', e.target.value)}
                                                onBlur={(e) => handleInputChange('linkedin', normalizeUrl(e.target.value))}
                                                placeholder="https://linkedin.com/company/yourpage"
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                    settings.linkedin && !isValidUrl(settings.linkedin)
                                                        ? "border-red-300 focus:border-red-500"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* App Download Stores */}
                                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Play Store Link (Android)</label>
                                            {settings.playStoreLink && !isValidUrl(settings.playStoreLink) && (
                                                <span className="text-[10px] font-bold text-red-500">Invalid URL</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600" />
                                            <input
                                                type="url"
                                                maxLength={500}
                                                value={settings.playStoreLink || ''}
                                                onChange={(e) => handleInputChange('playStoreLink', e.target.value)}
                                                onBlur={(e) => handleInputChange('playStoreLink', normalizeUrl(e.target.value))}
                                                placeholder="https://play.google.com/store/apps/details?id=..."
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                    settings.playStoreLink && !isValidUrl(settings.playStoreLink)
                                                        ? "border-red-300 focus:border-red-500"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">App Store Link (iOS)</label>
                                            {settings.appStoreLink && !isValidUrl(settings.appStoreLink) && (
                                                <span className="text-[10px] font-bold text-red-500">Invalid URL</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-800" />
                                            <input
                                                type="url"
                                                maxLength={500}
                                                value={settings.appStoreLink || ''}
                                                onChange={(e) => handleInputChange('appStoreLink', e.target.value)}
                                                onBlur={(e) => handleInputChange('appStoreLink', normalizeUrl(e.target.value))}
                                                placeholder="https://apps.apple.com/app/id..."
                                                className={cn(
                                                    "w-full pl-12 pr-5 py-4 bg-slate-50 border rounded-2xl text-sm font-bold text-slate-900 outline-none transition-all",
                                                    settings.appStoreLink && !isValidUrl(settings.appStoreLink)
                                                        ? "border-red-300 focus:border-red-500"
                                                        : "border-slate-200/80 focus:border-indigo-500/40 focus:bg-white"
                                                )}
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
                                {/* Meta Title */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Default Meta Title
                                        </label>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {(settings.metaTitle || '').length}/70 (Optimal: 50-60)
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={70}
                                        value={settings.metaTitle || ''}
                                        onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                                        placeholder="e.g. Anushka Store - Fresh Groceries & Quick 30-Min Delivery"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/40 focus:bg-white transition-all"
                                    />
                                </div>

                                {/* Meta Description */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Default Meta Description
                                        </label>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {(settings.metaDescription || '').length}/160 (Optimal: 150-160)
                                        </span>
                                    </div>
                                    <textarea
                                        rows={3}
                                        maxLength={160}
                                        value={settings.metaDescription || ''}
                                        onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                                        placeholder="Order daily essentials, fruits, vegetables, snacks, and dairy products online at Anushka Store with instant doorstep delivery."
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/40 focus:bg-white transition-all resize-none"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 italic text-right">Recommended length for Google snippets: 150-160 characters</p>
                                </div>

                                {/* Meta Keywords */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Meta Keywords
                                        </label>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {(settings.metaKeywords || '').length}/250
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={250}
                                        value={settings.metaKeywords || ''}
                                        onChange={(e) => handleInputChange('metaKeywords', e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500/40 focus:bg-white transition-all"
                                        placeholder="grocery, anushka store, online store, fast delivery, fresh vegetables"
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

