import React, { useState, useEffect } from 'react';
import { 
    ChevronLeft, 
    ScrollText, 
    Shield, 
    Loader2, 
    Printer 
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import axiosInstance from '@core/api/axios';

const DEFAULT_LEGAL_PAGES = {
    terms: {
        customer: {
            title: 'Customer Terms & Conditions',
            badge: 'SHOPPER & CUSTOMER AGREEMENT',
            subtitle: 'Applicable to all registered users & shoppers.',
            content: `
<div class="space-y-4 text-slate-700 text-sm leading-relaxed">
  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Account Registration & Eligibility</h3>
    <p>To place orders on Anushka Connect, you must be at least 18 years of age or access the service under parental supervision. You agree to provide accurate, current contact numbers and delivery addresses to ensure smooth order processing.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Product Pricing & Order Placement</h3>
    <p>All product prices, applicable taxes, and delivery charges are transparently displayed at checkout before order confirmation. Orders can be paid using authorized online payment methods (UPI, Cards, Wallets) or Cash on Delivery (COD) where available.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Delivery & Handoff Verification</h3>
    <p>Delivery timeframes are estimates and may vary based on traffic, weather, or operational factors. Quick-commerce local deliveries are completed upon customer OTP verification or physical handover at the designated doorstep address.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Cancellations, Returns & Refunds</h3>
    <p>You may cancel an order before the seller begins packing. For delivered eligible goods, returns must be requested within the product return window in original, unused condition. Approved refunds are credited to your Anushka Connect wallet or original payment source.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Platform Fair Use & Conduct</h3>
    <p>Users agree not to misuse promotional coupons, place fraudulent orders, or mistreat delivery partners and merchant staff. Any abusive conduct or fraudulent activity may result in immediate account deactivation and order cancellations.</p>
  </div>
</div>
`
        },
        seller: {
            title: 'Seller Terms & Conditions',
            badge: 'MERCHANT & SELLER AGREEMENT',
            subtitle: 'Applicable to all registered merchants & store partners.',
            content: `
<div class="space-y-4 text-slate-700 text-sm leading-relaxed">
  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Merchant Onboarding & KYC Verification</h3>
    <p>All sellers must register with authentic business information, valid GSTIN (where required), owner PAN, FSSAI registration for food products, and verified bank account details matching the business entity prior to listing items.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Catalog Integrity & Genuine Products</h3>
    <p>Sellers are solely responsible for product quality, MRP accuracy, and stock availability. Selling counterfeit, expired, defective, or prohibited goods is strictly forbidden and results in immediate store suspension, inventory forfeiture, and statutory legal reporting.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Order Fulfillment & Preparation SLA</h3>
    <p>Sellers must accept incoming orders promptly and complete packing and labeling within the agreed preparation timeframe to ensure seamless handoff to assigned delivery riders or shipping couriers.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Platform Commission & Bank Settlements</h3>
    <p>The platform deducts agreed category commissions, logistics fees, and statutory taxes (TCS/TDS) per fulfilled order. Net payouts are automatically disbursed directly into the seller's verified bank account according to the scheduled payout calendar.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Customer Returns & Dispute Resolution</h3>
    <p>Sellers agree to inspect return parcels (QC Check) delivered back to the store. Genuine customer returns must be acknowledged for refund processing. Sellers can file claims with photographic evidence for damaged or tampered return parcels via Seller Support.</p>
  </div>
</div>
`
        },
        delivery: {
            title: 'Delivery Partner Terms & Conditions',
            badge: 'FLEET & RIDER AGREEMENT',
            subtitle: 'Applicable to all registered delivery executives & fleet partners.',
            content: `
<div class="space-y-4 text-slate-700 text-sm leading-relaxed">
  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Independent Contractor Relationship</h3>
    <p>You join Anushka Connect as an independent freelance delivery executive. You have the full freedom to choose when to log in, accept delivery assignments, and take breaks. This agreement does not create an employer-employee relationship.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Onboarding & Documentation Requirements</h3>
    <p>To accept deliveries, you must be at least 18 years of age, hold a valid Indian Driving License, active Vehicle Registration (RC), active two-wheeler insurance, and possess a smartphone with active GPS connectivity.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Safe Delivery & Secure OTP Verification</h3>
    <p>Delivery partners must inspect parcels for secure merchant packaging before departing the store. Deliveries must be completed directly to the customer’s address and verified by entering the customer’s secure delivery OTP into the app.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Cash on Delivery (COD) Remittance</h3>
    <p>All cash collected for COD orders is the exclusive property of Anushka Connect. Partners must remit or deposit all cash collections on the same day within the assigned cash limit. Unauthorized cash retention results in immediate deactivation and recovery proceedings.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Road Safety & Code of Conduct</h3>
    <p>Wearing a protective helmet, obeying all traffic safety laws, and maintaining respectful conduct toward customers and store staff is mandatory. Substance abuse or reckless riding results in permanent platform blacklisting.</p>
  </div>
</div>
`
        }
    },
    privacy: {
        customer: {
            title: 'Customer Privacy Policy',
            badge: 'SHOPPER & CUSTOMER DATA POLICY',
            subtitle: 'Applicable to all registered users & shoppers.',
            content: `
<div class="space-y-4 text-slate-700 text-sm leading-relaxed">
  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Information We Collect</h3>
    <p>We collect your name, mobile number, email address, delivery addresses, and order history when you create an account and place orders on Anushka Connect. Payment card details and net banking credentials are never stored on our servers; they are processed securely through RBI-authorized payment gateways.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">2. How We Use Your Information</h3>
    <p>Your data is utilized solely to process your orders, provide accurate doorstep deliveries, send real-time order status updates via SMS and WhatsApp, and handle customer support and refund requests.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Data Sharing for Order Fulfillment</h3>
    <p>We share only your necessary delivery details (name, delivery address, and contact number) with assigned merchants and delivery executives exclusively to fulfill your active orders. We never sell, rent, or trade your personal data to third-party marketing companies.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Data Security & Storage</h3>
    <p>We implement industry-standard 256-bit SSL encryption, tokenized authentication, and secure cloud storage in compliance with Indian data protection norms to safeguard your personal information against unauthorized access.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Your Privacy Rights & Account Management</h3>
    <p>You have full control over your information. You can review, update, or request the deletion of your account and personal data at any time through the in-app Profile Settings or by reaching out to our Grievance Officer at <strong>support@anushkaconnect.com</strong>.</p>
  </div>
</div>
`
        },
        seller: {
            title: 'Seller Privacy Policy',
            badge: 'MERCHANT & STORE DATA POLICY',
            subtitle: 'Applicable to all registered merchants & store partners.',
            content: `
<div class="space-y-4 text-slate-700 text-sm leading-relaxed">
  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Introduction</h3>
    <p>This Seller Privacy Policy explains how <strong>Anushka Connect</strong> collects, utilizes, stores, and protects the business and personal information of Merchant Partners and Shop Owners using our Seller Center and Merchant Mobile Application.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">2. Information Collected from Sellers</h3>
    <p>To enable merchant onboarding, catalog management, and bank payouts, we collect your store name, owner identity proof (PAN, Aadhaar), business registrations (GSTIN, FSSAI license, Trade Certificate), verified bank account details, physical store GPS coordinates, and product catalog inventory.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Purpose of Processing Seller Data</h3>
    <p>Seller information is strictly processed to verify business credentials, display your shop to nearby shoppers, compute sales commissions, deposit statutory GST/TCS with government authorities, disburse weekly bank payouts, and dispatch incoming customer orders.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Device Permissions & Security</h3>
    <p>The Seller App requires camera and file access solely for photographing product listings and uploading verification documents, foreground location to mark accurate store pickup points, and push notifications for instant incoming order alerts. All records are secured using enterprise-grade encryption.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Customer Data Confidentiality</h3>
    <p>Customer names and addresses provided for order packing are strictly confidential. Sellers are prohibited from saving customer contact numbers, contacting buyers for personal marketing, or sharing customer data with external parties.</p>
  </div>
</div>
`
        },
        delivery: {
            title: 'Delivery Partner Privacy Policy',
            badge: 'FLEET & RIDER DATA POLICY',
            subtitle: 'Applicable to all registered delivery executives & fleet partners.',
            content: `
<div class="space-y-4 text-slate-700 text-sm leading-relaxed">
  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">1. Introduction</h3>
    <p>This Delivery Partner Privacy Policy outlines how <strong>Anushka Connect</strong> collects, utilizes, and protects the personal and location data of delivery executives using our Rider Mobile Application.</p>
  </div>

  <div class="bg-amber-50/90 border border-amber-300 p-3.5 rounded-xl">
    <h3 class="text-base font-bold text-amber-950 mb-1">2. Prominent Background Location Disclosure (Google Play Requirement)</h3>
    <p class="text-xs text-amber-900 leading-relaxed mb-2">The Anushka Connect Delivery Partner App collects real-time location data, including when the app is running in the <strong>background (app minimized, closed, or screen locked)</strong>, for the following essential purposes:</p>
    <ul class="text-xs list-disc pl-5 space-y-1 text-amber-900 font-medium">
      <li><strong>Proximity Order Matching:</strong> Assigning delivery orders to you based on your live distance from merchant stores.</li>
      <li><strong>Customer Live Tracking:</strong> Allowing the customer to view live delivery progress on the order map.</li>
      <li><strong>Accurate Distance Payouts:</strong> Calculating your per-kilometer travel earnings and surge incentives.</li>
      <li><strong>Rider Safety:</strong> Locating your vehicle during emergency SOS alerts.</li>
    </ul>
    <p class="text-[11px] font-bold text-amber-950 mt-2">Background location collection is active ONLY when your duty toggle is set to "ONLINE" and stops completely when you switch to "OFFLINE".</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">3. Personal & Verification Information</h3>
    <p>For onboarding, identity verification, and payouts, we collect your full name, mobile number, Aadhaar card, PAN card, Driving License (DL), Vehicle Registration Certificate (RC), vehicle insurance, and bank/UPI payment details.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">4. Customer Data Confidentiality</h3>
    <p>Customer names, addresses, and phone numbers shown on delivery tasks are provided strictly for completing delivery. Saving customer numbers, calling customers after delivery, or sharing customer information is strictly prohibited.</p>
  </div>

  <div>
    <h3 class="text-base font-bold text-slate-900 mb-1">5. Data Protection & Account Management</h3>
    <p>All rider operational logs and payout histories are encrypted and stored securely. You may review your profile details or request account deactivation at any time through Rider Support at <strong>delivery-support@anushkaconnect.com</strong>.</p>
  </div>
</div>
`
        }
    }
};

const DynamicLegalPage = ({ type: propType, audience: propAudience, onBack }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { settings } = useSettings();
    const appName = settings?.general?.storeName || 'Anushka Connect';

    // 1. Resolve document type: 'terms' | 'privacy'
    const resolvedType = propType || (() => {
        const p = location.pathname.toLowerCase();
        if (p.includes('terms')) return 'terms';
        if (p.includes('privacy')) return 'privacy';
        return 'terms';
    })();

    // 2. Resolve audience: 'seller' | 'delivery' | 'customer'
    const resolvedAudience = (() => {
        if (propAudience) return propAudience;
        const qAud = searchParams.get('audience') || searchParams.get('role');
        if (qAud && ['customer', 'seller', 'delivery'].includes(qAud.toLowerCase())) {
            return qAud.toLowerCase();
        }
        const p = location.pathname.toLowerCase();
        if (p.startsWith('/seller') || p.includes('/seller')) return 'seller';
        if (p.startsWith('/delivery') || p.includes('/delivery')) return 'delivery';
        return 'customer';
    })();

    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchPage = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get('/api/legal', {
                    params: { type: resolvedType, audience: resolvedAudience }
                });
                if (isMounted) {
                    const result = res.data?.result || res.data?.data;
                    if (result && result.content) {
                        setPage(result);
                    } else {
                        setPage(null);
                    }
                }
            } catch {
                if (isMounted) {
                    setPage(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };
        fetchPage();
        return () => {
            isMounted = false;
        };
    }, [resolvedType, resolvedAudience]);

    const defaults = DEFAULT_LEGAL_PAGES[resolvedType]?.[resolvedAudience] || 
                     DEFAULT_LEGAL_PAGES[resolvedType]?.customer || 
                     DEFAULT_LEGAL_PAGES.terms.customer;

    const title = page?.title || defaults.title;
    const content = page?.content || defaults.content;
    const badgeLabel = defaults.badge || (resolvedType === 'privacy' ? 'DATA PRIVACY POLICY' : 'TERMS & CONDITIONS');
    const subtitle = defaults.subtitle || `Applicable to ${appName}.`;
    const lastUpdated = page?.updatedAt
        ? new Date(page.updatedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'October 2026';

    const Icon = resolvedType === 'privacy' ? Shield : ScrollText;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-slate-100 font-['Outfit',_sans-serif] pb-12 text-slate-800">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs print:hidden">
                <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            type="button"
                            onClick={() => onBack ? onBack() : (window.history.length > 1 ? navigate(-1) : navigate('/'))}
                            className="w-9 h-9 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1.5 shrink-0 text-slate-700 hover:text-slate-900 cursor-pointer"
                            aria-label="Go back"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block truncate">
                                {appName.toUpperCase()} LEGAL CENTER
                            </span>
                            <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                                {title}
                            </h1>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer shrink-0"
                        title="Print or Save PDF"
                    >
                        <Printer size={15} />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="px-3 sm:px-4 pt-4 sm:pt-6 max-w-3xl mx-auto space-y-4">
                {/* Banner Card - Matching Phone Mockup */}
                <div className="bg-[#10172a] rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-md relative overflow-hidden">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0 mt-0.5">
                            <Icon size={24} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider bg-white/15 text-slate-200 uppercase mb-1.5">
                                {badgeLabel}
                            </span>
                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                                {title}
                            </h2>
                            <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                                {subtitle}
                            </p>
                            <div className="mt-3.5 inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span>Last updated: {lastUpdated}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Card with 4-5 Clean Points */}
                <article className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xs border border-slate-200/80">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center">
                            <Loader2 size={30} className="animate-spin text-primary mb-3" />
                            <p className="text-xs text-slate-500 font-bold">Loading guidelines...</p>
                        </div>
                    ) : (
                        <div
                            className="legal-content text-slate-700"
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    )}

                    {/* Official Contact Info */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
                        <div>
                            <p className="font-bold text-slate-700">Official Grievance Desk</p>
                            <p className="text-[11px] text-slate-400">For inquiries or compliance requests</p>
                        </div>
                        <a
                            href={`mailto:${resolvedAudience === 'seller' ? 'seller-support@anushkaconnect.com' : resolvedAudience === 'delivery' ? 'delivery-support@anushkaconnect.com' : 'support@anushkaconnect.com'}`}
                            className="font-bold text-primary hover:underline"
                        >
                            {resolvedAudience === 'seller' ? 'seller-support@anushkaconnect.com' : resolvedAudience === 'delivery' ? 'delivery-support@anushkaconnect.com' : 'support@anushkaconnect.com'}
                        </a>
                    </div>
                </article>
            </main>
        </div>
    );
};

export default DynamicLegalPage;
