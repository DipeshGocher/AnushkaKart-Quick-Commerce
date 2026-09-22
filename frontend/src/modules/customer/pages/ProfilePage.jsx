import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User, MapPin, Package, CreditCard, Wallet, ChevronRight,
    LogOut, ShieldCheck, Heart, HelpCircle, Info, Edit2, Bell,
    ClipboardCheck, Ticket, LifeBuoy, MapPinned, CalendarCheck, Globe, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import { cn } from '@/lib/utils';

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const { t, language, setLanguage, languages } = useTranslation();
    const appName = settings?.appName || 'App';
    const [showLogoutModal, setShowLogoutModal] = React.useState(false);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isLangExpanded, setIsLangExpanded] = React.useState(false);

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await customerApi.deleteAccount();
            toast.success("Account deleted successfully.");
            setShowDeleteModal(false);
            logout();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to delete account");
            setIsDeleting(false);
        }
    };

    const formatIndiaPhone = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('+91')) return raw.replace(/^\+91[\s-]*/, '');
        if (raw.startsWith('91') && raw.length >= 12) return raw.replace(/^91[\s-]*/, '');
        return raw;
    };

    return (
        <>
            <div className="min-h-screen bg-[#f1f4f8] pb-20 font-['Outfit',_sans-serif]">
            {/* Header without Back Button */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-100 mb-4 flex items-center justify-between shadow-2xs">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('myProfile')}</h1>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/notifications')}
                        title="View notifications"
                        className="w-10 h-10 flex items-center justify-center rounded-full transition-colors border border-slate-200 bg-white hover:bg-slate-100 shadow-2xs"
                    >
                        <Bell size={18} className="text-slate-700" />
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">

                {/* User Identity Card with Blue & Orange Mix Accent */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-orange-500 via-amber-400 to-blue-600 border-2 border-orange-300/80 flex items-center justify-center p-0.5 shadow-sm shrink-0">
                            <div className="h-full w-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                                {user?.avatar || user?.profileImage ? (
                                    <img 
                                        src={user.avatar || user.profileImage} 
                                        alt={user?.name || 'Customer'} 
                                        className="w-full h-full object-cover rounded-full" 
                                    />
                                ) : (
                                    <User size={26} className="text-[#0F172A]" />
                                )}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-base leading-tight font-bold text-[#0F172A]">{user?.name || 'Customer'}</h2>
                            <p className="text-slate-500 text-xs font-semibold flex items-center gap-1 mt-1">
                                <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase">India</span> +91 {formatIndiaPhone(user?.phone)}
                            </p>
                        </div>
                    </div>
                    <Link to="/profile/edit" className="p-2.5 rounded-xl bg-orange-50/80 text-orange-600 hover:bg-orange-100 border border-orange-100 transition-colors shadow-2xs">
                        <Edit2 size={16} />
                    </Link>
                </div>

                {/* Quick Action Badges (Mix of Blue & Orange Themes) */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="grid grid-cols-4 gap-2">
                        {/* 1. Orders (Blue - Refurbished theme) */}
                        <button
                            onClick={() => navigate('/orders')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-50/90 border border-blue-100 text-blue-600 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <CalendarCheck size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{t('yourOrders')}</span>
                        </button>

                        {/* 2. Transactions (Orange - Grocery theme) */}
                        <button
                            onClick={() => navigate('/transactions')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-orange-50/90 border border-orange-100 text-orange-600 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <CreditCard size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">Transactions</span>
                        </button>

                        {/* 3. Wallet (Blue/Sky - Refurbished theme) */}
                        <button
                            onClick={() => navigate('/wallet')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-sky-50/90 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <Wallet size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{t('wallet')}</span>
                        </button>

                        {/* 4. Saved Addresses (Orange/Amber - Grocery theme) */}
                        <button
                            onClick={() => navigate('/addresses')}
                            className="flex flex-col items-center text-center group py-1"
                        >
                            <div className="w-12 h-12 rounded-full bg-amber-50/90 border border-amber-100 text-amber-600 flex items-center justify-center shadow-2xs mb-1.5 group-hover:scale-108 transition-transform">
                                <MapPinned size={22} strokeWidth={2.5} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">{t('savedAddresses')}</span>
                        </button>
                    </div>
                </div>

                {/* Menu Sections */}
                <div className="space-y-4">
                    {/* Account Section - Cart and Wishlist removed */}
                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('personalAccount')}</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {/* Blue */}
                            <MenuItem
                                icon={CalendarCheck}
                                label={t('yourOrders')}
                                sub={t('trackReturn')}
                                path="/orders"
                                badgeBg="bg-blue-50/90 border-blue-100 text-blue-600"
                            />
                            {/* Orange */}
                            <MenuItem
                                icon={CreditCard}
                                label={t('transactions') || 'Order Transactions'}
                                sub={t('viewPayments')}
                                path="/transactions"
                                badgeBg="bg-orange-50/90 border-orange-100 text-orange-600"
                            />
                            {/* Blue */}
                            <MenuItem
                                icon={Wallet}
                                label={t('wallet')}
                                sub={t('balanceRefunds')}
                                path="/wallet"
                                badgeBg="bg-sky-50/90 border-sky-100 text-sky-600"
                            />
                            {/* Orange */}
                            <MenuItem
                                icon={MapPinned}
                                label={t('savedAddresses')}
                                sub={t('manageLocations')}
                                path="/addresses"
                                badgeBg="bg-amber-50/90 border-amber-100 text-amber-600"
                            />
                        </div>
                    </div>

                    {/* Support Section */}
                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('helpSettings')}</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {/* Select Language Accordion */}
                            <div>
                                <button
                                    onClick={() => setIsLangExpanded(!isLangExpanded)}
                                    className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full border bg-blue-50/90 border-blue-100 text-blue-600 flex items-center justify-center shadow-2xs group-hover:scale-108 transition-transform flex-shrink-0">
                                            <Globe size={18} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 leading-tight">{t('selectLanguage')}</h3>
                                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                                {languages.find(l => l.code === language)?.flag} {languages.find(l => l.code === language)?.name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors">
                                        <ChevronRight 
                                            size={16} 
                                            className={cn("text-slate-400 group-hover:text-slate-600 transition-all", isLangExpanded ? "rotate-90 text-slate-600" : "")} 
                                        />
                                    </div>
                                </button>
                                
                                {isLangExpanded && (
                                    <div className="bg-slate-50/50 border-t border-slate-100/60 divide-y divide-slate-100/60 transition-all duration-300">
                                        {languages.map((lang) => (
                                            <button
                                                key={lang.code}
                                                type="button"
                                                onClick={() => setLanguage(lang.code)}
                                                className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-100/40 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg leading-none">{lang.flag}</span>
                                                    <span className={`text-xs font-bold transition-colors ${
                                                        language === lang.code ? 'text-primary font-black' : 'text-slate-600'
                                                    }`}>
                                                        {lang.name}
                                                    </span>
                                                </div>
                                                {language === lang.code && (
                                                    <div className="w-2 h-2 rounded-full bg-primary shadow-xs" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Orange */}
                            <MenuItem
                                icon={LifeBuoy}
                                label={t('helpSupport')}
                                path="/help"
                                badgeBg="bg-orange-50/90 border-orange-100 text-orange-600"
                            />
                            {/* Blue */}
                            <MenuItem
                                icon={ShieldCheck}
                                label={t('privacy')}
                                path="/privacy"
                                badgeBg="bg-blue-50/90 border-blue-100 text-blue-600"
                            />
                            {/* Orange */}
                            <MenuItem
                                icon={Info}
                                label={t('aboutUs')}
                                path="/about"
                                badgeBg="bg-orange-50/90 border-orange-100 text-orange-600"
                            />
                        </div>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={() => setShowLogoutModal(true)}
                    className="w-full py-3.5 rounded-2xl border border-slate-200 text-slate-700 font-bold bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 mt-2 shadow-2xs"
                >
                    <LogOut size={18} className="text-slate-600" />
                    {t('signOut')}
                </button>

                {/* Delete Account Button */}
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full py-3.5 rounded-2xl border border-red-200 text-red-600 font-bold bg-red-50/50 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 mt-4 shadow-2xs"
                >
                    <AlertTriangle size={18} className="text-red-500" />
                    Delete Account
                </button>

                <div className="text-center pb-8 mt-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Version 2.4.0 • {appName}</p>
                </div>

            </div>
        </div>

        {/* Logout Confirmation Modal */}
        {showLogoutModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                        <LogOut size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-2">{t('signOutTitle')}</h3>
                    <p className="text-sm font-medium text-slate-500 text-center mb-6">
                        {t('signOutConfirm')}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowLogoutModal(false)}
                            className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={() => {
                                setShowLogoutModal(false);
                                logout();
                            }}
                            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                        >
                            {t('yesSignOut')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Delete Account Confirmation Modal */}
        {showDeleteModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-2">Delete Account?</h3>
                    <p className="text-sm font-medium text-slate-500 text-center mb-6">
                        Are you sure you want to delete your account? This action cannot be undone. You will be logged out and your profile will become inactive.
                    </p>
                    <div className="flex gap-3">
                        <button
                            disabled={isDeleting}
                            onClick={() => setShowDeleteModal(false)}
                            className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            disabled={isDeleting}
                            onClick={handleDeleteAccount}
                            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 disabled:opacity-50"
                        >
                            {isDeleting ? "Deleting..." : "Yes, Delete"}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
    );
};

const MenuItem = ({ icon: Icon, label, sub = '', path = '', onClick = undefined, badgeBg = '' }) => {
    const Component = onClick ? 'button' : Link;
    return (
    <Component to={path || undefined} onClick={onClick} className="w-full text-left px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-colors group">
        <div className="flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-full border flex items-center justify-center shadow-2xs group-hover:scale-108 transition-transform flex-shrink-0", badgeBg || "bg-slate-50 border-slate-100 text-slate-600")}>
                <Icon size={18} strokeWidth={2.5} />
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-800 leading-tight">{label}</h3>
                {sub && <p className="text-[11px] font-medium text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
        <div className="p-1.5 rounded-full group-hover:bg-slate-100 transition-colors">
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-600 transition-all group-hover:translate-x-0.5" />
        </div>
    </Component>
    );
};

export default ProfilePage;
