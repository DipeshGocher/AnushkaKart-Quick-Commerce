import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Youtube, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import Logo from '@/assets/Logo.png';
import { useSettings } from '@core/context/SettingsContext';

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

const Footer = () => {
    const { settings } = useSettings();

    if (settings?.footerEnabled === false) {
        return null;
    }

    const logoUrl = settings?.logoUrl;
    const primaryColor = settings?.primaryColor || 'var(--primary)';
    const customBg = settings?.footerBgColor;

    const quickLinks = Array.isArray(settings?.footerQuickLinks) && settings.footerQuickLinks.length > 0
        ? settings.footerQuickLinks
        : DEFAULT_QUICK_LINKS;

    const categoryLinks = Array.isArray(settings?.footerCategoriesLinks) && settings.footerCategoriesLinks.length > 0
        ? settings.footerCategoriesLinks
        : DEFAULT_CATEGORIES_LINKS;

    const copyrightText = settings?.footerCopyright
        ? settings.footerCopyright.replace('{year}', new Date().getFullYear())
        : `© ${new Date().getFullYear()} ${settings?.appName || 'AnushkaStore'}. All rights reserved.`;

    return (
        <footer
            className="hidden lg:block relative w-full bg-[#051108] lg:bg-gradient-to-br lg:from-brand-700 lg:via-brand-800 lg:to-brand-900 pt-12 pb-10 mt-12 md:mt-16 overflow-hidden z-10 text-slate-300 border-t border-white/10"
            style={customBg ? { background: customBg } : undefined}
        >
            {/* Subtle Texture/Glow Overlay */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 blur-[150px]" style={{ backgroundColor: primaryColor }} />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-[150px]" style={{ backgroundColor: primaryColor }} />
            </div>

            <div className="container mx-auto px-4 z-10 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-16">

                    {/* Brand Info */}
                    <div className="space-y-4 md:space-y-8">
                        <div className="flex items-center">
                            <Link to="/">
                                <img src={logoUrl || Logo || "/logo.png"} alt={`${settings?.appName || 'AnushkaStore'} Logo`} loading="lazy" className="h-12 md:h-16 w-auto object-contain cursor-pointer" />
                            </Link>
                        </div>
                        <p className="text-sm leading-relaxed md:text-base md:leading-loose text-white/90 md:max-w-xs transition-opacity hover:opacity-100 font-medium">
                            {settings?.footerDescription || 'Your daily dose of fresh, organic, and healthy products delivered straight to your door. Freshness guaranteed.'}
                        </p>
                        <div className="flex gap-4">
                            {settings?.facebook && <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="Facebook"><Facebook size={18} /></a>}
                            {settings?.twitter && <a href={settings.twitter} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="Twitter"><Twitter size={18} /></a>}
                            {settings?.instagram && <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="Instagram"><Instagram size={18} /></a>}
                            {settings?.youtube && <a href={settings.youtube} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="YouTube"><Youtube size={18} /></a>}
                            {settings?.linkedin && <a href={settings.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 text-white rounded-full transition-all group active:scale-95 hover:opacity-90" aria-label="LinkedIn"><Linkedin size={18} /></a>}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> {settings?.footerQuickLinksTitle || 'Quick Links'}
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            {quickLinks.map((item, idx) => (
                                <li key={idx}>
                                    <Link to={item.url || '/'} className="hover:text-brand-300 transition-colors md:text-base md:font-semibold flex items-center group text-white">
                                        <span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Categories */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> {settings?.footerCategoriesTitle || 'Categories'}
                        </h3>
                        <ul className="space-y-2 md:space-y-4">
                            {categoryLinks.map((item, idx) => (
                                <li key={idx}>
                                    <Link to={item.url || '/categories'} className="hover:text-brand-300 transition-colors md:text-base md:font-semibold flex items-center group text-white">
                                        <span className="hidden md:block w-0 h-px bg-white group-hover:w-4 group-hover:mr-2 transition-all"></span>
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="md:pt-4">
                        <h3 className="text-white font-bold text-lg mb-4 md:text-xl md:font-black md:uppercase md:tracking-widest md:mb-8 flex items-center gap-2">
                            <span className="h-1 w-4 hidden md:block" style={{ backgroundColor: primaryColor }}></span> {settings?.footerContactTitle || 'Contact Us'}
                        </h3>
                        <ul className="space-y-4 md:space-y-6">
                            <li className="flex items-start gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><MapPin size={22} /></div>
                                <MapPin className="mt-1 shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white md:pt-1 font-medium">{settings?.address || 'Corporate House, RNT Marg'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><Phone size={22} /></div>
                                <Phone className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white font-medium">{settings?.supportPhone || '+91 98765 43210'}</span>
                            </li>
                            <li className="flex items-center gap-3 md:gap-5 group">
                                <div className="hidden md:flex h-12 w-12 rounded-xl bg-white/10 items-center justify-center text-white transition-all shrink-0 group-hover:opacity-90"><Mail size={22} /></div>
                                <Mail className="shrink-0 md:hidden" size={18} style={{ color: primaryColor }} />
                                <span className="md:text-base text-white font-medium">{settings?.supportEmail || 'support@anushkastore.com'}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 mt-10 pt-6 text-center text-sm md:flex md:justify-between md:text-left md:mt-20 md:pt-10">
                    <p className="md:text-base text-white/60">{copyrightText}</p>
                    <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0 md:gap-12">
                        <Link to={settings?.footerPrivacyUrl || '/privacy'} className="hover:text-brand-300 md:text-base text-white/60 transition-all">Privacy Policy</Link>
                        <Link to={settings?.footerTermsUrl || '/support'} className="hover:text-brand-300 md:text-base text-white/60 transition-all">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
