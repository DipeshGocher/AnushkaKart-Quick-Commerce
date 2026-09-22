import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Trash2, CheckCircle2, Eye, 
  MessageSquare, Heart, MapPin, Calendar, Share2, 
  Tag, ShieldCheck, ChevronRight, ExternalLink, RefreshCw, AlertCircle
} from 'lucide-react';
import { 
  getC2CAds, 
  getC2CAdById, 
  updateC2CAd, 
  deleteC2CAd 
} from '../../data/c2cMockData';
import { toast } from 'sonner';

const C2CMyProductDetailPage = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support both /marketplace/my-listings/product/:id and /marketplace/my-listings/product?id=...
  const adId = params.id || searchParams.get('id') || searchParams.get('productId');

  const [ad, setAd] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadAd();
  }, [adId]);

  const loadAd = () => {
    setLoading(true);
    const ads = getC2CAds();
    let found = null;
    if (adId) {
      found = ads.find(a => String(a.id) === String(adId));
    }
    // Fallback if not found: find user's first ad or c2c-1
    if (!found) {
      found = ads.find(a => a.isUserAd || a.id === 'c2c-1') || ads[0];
    }
    setAd(found);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-10 h-10 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Listing Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">The listing you are looking for might have been removed.</p>
        <button
          type="button"
          onClick={() => navigate('/marketplace/my-listings')}
          className="px-5 py-2.5 bg-[#0F4C81] text-white text-xs font-bold rounded-xl"
        >
          Back to My Listings
        </button>
      </div>
    );
  }

  const isSold = ad.status === 'Sold';

  const handleToggleSold = () => {
    const nextStatus = isSold ? 'Active' : 'Sold';
    const updated = updateC2CAd(ad.id, { status: nextStatus });
    if (updated) {
      setAd(updated);
      toast.success(nextStatus === 'Sold' ? 'Listing marked as Sold!' : 'Listing reactivated to Active!');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this listing permanently?')) {
      deleteC2CAd(ad.id);
      toast.success('Listing deleted successfully');
      navigate('/marketplace/my-listings');
    }
  };

  const handleShare = async () => {
    const publicUrl = `${window.location.origin}/marketplace/product/${ad.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: ad.title,
          text: `Check out my listing for "${ad.title}" on AnushkaKart:`,
          url: publicUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(publicUrl);
      toast.success('Listing link copied to clipboard!');
    }
  };

  const images = (ad.images && ad.images.length > 0) 
    ? ad.images 
    : ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800'];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/marketplace/my-listings')}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 transition-colors cursor-pointer"
            aria-label="Back to My Listings"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                My Listing Details
              </h1>
              <span className="text-[10px] uppercase font-black tracking-wider bg-blue-50 text-[#0F4C81] border border-blue-200 px-1.5 py-0.5 rounded">
                Owner View
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              ID: {ad.id} • {ad.categoryName || ad.category || 'Classifieds'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShare}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
            title="Share Listing"
          >
            <Share2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-600 transition-colors cursor-pointer"
            title="Delete Listing"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-3.5 space-y-3.5">
        {/* Status & Analytics Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isSold ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Status: {isSold ? 'Sold Out' : 'Active & Listed'}
                </span>
                <p className="text-[11px] text-slate-500">
                  {isSold ? 'Buyers see this item as already sold' : 'Visible to buyers in your city'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2 pt-3 text-center">
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-[11px] font-semibold mb-0.5">
                <Eye size={13} className="text-[#0F4C81]" />
                <span>Views</span>
              </div>
              <span className="text-base font-black text-slate-900">
                {ad.views || 412}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-[11px] font-semibold mb-0.5">
                <MessageSquare size={13} className="text-emerald-600" />
                <span>Inquiries</span>
              </div>
              <span className="text-base font-black text-slate-900">
                8
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="flex items-center justify-center gap-1 text-slate-500 text-[11px] font-semibold mb-0.5">
                <Heart size={13} className="text-rose-500" />
                <span>Wishlists</span>
              </div>
              <span className="text-base font-black text-slate-900">
                14
              </span>
            </div>
          </div>
        </div>

        {/* Media Gallery Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="relative aspect-4/3 bg-slate-900">
            <img
              src={images[activeImageIndex]}
              alt={ad.title}
              className={`w-full h-full object-contain ${isSold ? 'opacity-70 grayscale' : ''}`}
            />
            {/* Image counter */}
            <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
              {activeImageIndex + 1} / {images.length}
            </div>

            {isSold && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="bg-red-600 text-white font-black uppercase text-sm tracking-wider px-4 py-1.5 rounded-lg shadow-lg">
                  Sold Out
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="p-3 bg-slate-50 flex items-center gap-2 border-t border-slate-100 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    activeImageIndex === idx ? 'border-[#0F4C81] ring-2 ring-blue-200' : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pricing & Overview Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  ₹{ad.price?.toLocaleString('en-IN')}
                </span>
                {ad.originalPrice && (
                  <span className="text-sm font-semibold text-slate-400 line-through">
                    ₹{ad.originalPrice?.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#0F4C81] border border-blue-200">
                {ad.condition || 'Like New'}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1.5 leading-snug">
              {ad.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <MapPin size={13} className="text-slate-400" />
              {ad.location || ad.city || 'Indore'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              {ad.postedAt || 'Posted Today'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Tag size={13} className="text-slate-400" />
              {ad.categoryName || ad.category}
            </span>
          </div>
        </div>

        {/* Description Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
            Description
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 font-normal leading-relaxed whitespace-pre-line">
            {ad.description || 'No description provided.'}
          </p>
        </div>

        {/* Specs Table */}
        {ad.specs && Object.keys(ad.specs).length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
              Item Specifications
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {Object.entries(ad.specs).map(([key, val]) => (
                <div key={key} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {key}
                  </span>
                  <span className="text-xs font-extrabold text-slate-800">
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seller Info (You) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#0F4C81] text-white flex items-center justify-center font-black text-sm">
              YOU
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                  {ad.seller?.name || 'You (Verified Seller)'}
                </span>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                  Verified
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Phone: {ad.seller?.phone || '+91 98260 12345'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/marketplace/profile')}
            className="text-xs font-bold text-[#0F4C81] hover:underline"
          >
            My Profile
          </button>
        </div>
      </main>

      {/* Fixed Sticky Bottom Action Bar: Edit Details | Mark Sold */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2.5 shadow-lg">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2.5">
          {/* 1. Edit Product Details */}
          <button
            type="button"
            onClick={() => navigate(`/marketplace/my-listings/product/${ad.id}/edit`)}
            className="h-11 px-3 rounded-xl bg-[#0F4C81] hover:bg-[#0A365C] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#0F4C81]/25 transition-all cursor-pointer text-center"
            title="Edit Product Details"
          >
            <Edit3 size={15} strokeWidth={2.4} className="shrink-0" />
            <span>Edit Product Details</span>
          </button>

          {/* 2. Mark Sold / Mark Active */}
          <button
            type="button"
            onClick={handleToggleSold}
            className={`h-11 px-3 rounded-xl font-extrabold text-xs sm:text-sm border transition-all cursor-pointer text-center ${
              isSold 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
            title={isSold ? 'Reactivate listing' : 'Mark item as sold'}
          >
            <span>{isSold ? 'Mark Active' : 'Mark as Sold'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default C2CMyProductDetailPage;
