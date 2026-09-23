import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Heart, Share2, MapPin, Calendar, Eye, 
  ShieldCheck, MessageSquare, Tag, AlertTriangle, 
  ChevronRight, CheckCircle2, User, Sparkles, ImagePlus, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@core/context/AuthContext';
import { 
  getC2CAds, getC2CFavorites, toggleC2CFavorite, 
  sendC2CMessage, getC2CChats, createOrGetC2CChat 
} from '../../data/c2cMockData';
import { toast } from 'sonner';

const C2CProductDetailPage = ({ initialOfferOpen = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [ad, setAd] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    const ads = getC2CAds();
    const found = ads.find(a => a.id === id) || ads[0];
    setAd(found);

    const favs = getC2CFavorites();
    setIsFavorite(favs.includes(found?.id));

    if (found?.price) {
      setOfferAmount(Math.round(found.price * 0.9)); // default 10% lower offer
    }

    if (initialOfferOpen || searchParams.get('offer') === 'true' || location.pathname.endsWith('/offer')) {
      if (!isAuthenticated) {
        toast.info('Please log in to make an offer');
        navigate('/login', { state: { from: location } });
      } else {
        setShowOfferModal(true);
      }
    }
  }, [id, initialOfferOpen, searchParams, location.pathname, isAuthenticated, navigate, location]);

  if (!ad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9]">
        <div className="text-center p-6">
          <div className="w-12 h-12 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Loading marketplace listing...</p>
        </div>
      </div>
    );
  }

  const isOwner = ad.isUserAd || ad.seller?.id === 'seller-user' || ad.id === 'c2c-1';

  const handleFavoriteToggle = () => {
    if (!isAuthenticated) {
      toast.info('Please log in to save items to your wishlist');
      navigate('/login', { state: { from: location } });
      return;
    }
    const updatedFav = toggleC2CFavorite(ad.id);
    setIsFavorite(updatedFav);
    if (updatedFav) {
      toast.success('Ad saved to your Wishlist');
    } else {
      toast.info('Ad removed from Wishlist');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: ad.title,
          text: `Check out this ${ad.title} on AnushkaKart C2C Marketplace for ₹${ad.price?.toLocaleString('en-IN')}`,
          url: window.location.href,
        });
      } catch {
        // cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleOpenOfferModal = () => {
    if (!isAuthenticated) {
      toast.info('Please log in to make an offer');
      navigate('/login', { state: { from: location } });
      return;
    }
    setShowOfferModal(true);
  };

  const handleMakeOffer = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.info('Please log in to make an offer');
      navigate('/login', { state: { from: location } });
      return;
    }
    if (!offerAmount || Number(offerAmount) <= 0) {
      toast.error('Please enter a valid offer amount');
      return;
    }

    const chat = createOrGetC2CChat(ad);

    sendC2CMessage(
      chat.id,
      `I would like to offer ₹${Number(offerAmount).toLocaleString('en-IN')} for your item "${ad.title}"`,
      true,
      Number(offerAmount)
    );

    setShowOfferModal(false);
    toast.success(`Offer of ₹${Number(offerAmount).toLocaleString('en-IN')} sent to seller!`);
    navigate(`/marketplace/chats?id=${chat.id}`);
  };

  const handleStartChat = () => {
    if (!isAuthenticated) {
      toast.info('Please log in to chat with the owner');
      navigate('/login', { state: { from: location } });
      return;
    }
    const chat = createOrGetC2CChat(ad);
    navigate(`/marketplace/chats?id=${chat.id}`);
  };

  const handleRequestMoreImages = () => {
    if (!isAuthenticated) {
      toast.info('Please log in to request images from the seller');
      navigate('/login', { state: { from: location } });
      return;
    }
    const chat = createOrGetC2CChat(ad);
    sendC2CMessage(chat.id, "I want more images of this product");
    toast.success("Image request sent to seller!");
    navigate(`/marketplace/chats?id=${chat.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 text-slate-900 font-sans">
      {/* Top Floating App Bar */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {ad.categoryName || 'Marketplace Item'}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
            title="Share"
          >
            <Share2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleFavoriteToggle}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
            title="Save"
          >
            <Heart size={18} className={isFavorite ? "fill-red-500 text-red-500" : ""} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-3 space-y-4">
        {/* Images Gallery */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="relative aspect-4/3 sm:aspect-16/9 bg-slate-100 overflow-hidden">
            <img
              src={ad.images?.[activeImageIndex] || ad.images?.[0]}
              alt={ad.title}
              className="w-full h-full object-cover transition-all duration-300"
            />
            <div className="absolute bottom-3 right-3 bg-slate-950/70 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
              {activeImageIndex + 1} / {ad.images?.length || 1}
            </div>
          </div>

          {/* Thumbnail strip if multiple images */}
          {ad.images && ad.images.length > 1 && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 border-t border-slate-100 overflow-x-auto">
              {ad.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                    activeImageIndex === idx ? 'border-[#0F4C81] scale-105 shadow-xs' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pricing & Title Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#0F4C81] tracking-tight">
                ₹{ad.price?.toLocaleString('en-IN')}
              </span>
              {ad.originalPrice && (
                <span className="text-sm text-slate-400 line-through">
                  ₹{ad.originalPrice?.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#0F4C81] font-extrabold text-xs border border-[#0F4C81]/30">
              {ad.condition || 'Pre-owned'}
            </span>
          </div>

          <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-snug mb-3">
            {ad.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <MapPin size={14} className="text-[#0F4C81]" />
              <span>{ad.location || ad.city}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={14} className="text-slate-400" />
              <span>Posted {ad.postedAt}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye size={14} className="text-slate-400" />
              <span>{ad.views || 42} views</span>
            </div>
          </div>
        </div>

        {/* Safety Guidelines Card (OLX Signature feature for Buyers) */}
        <div className="bg-blue-50/80 rounded-2xl border border-[#0F4C81]/20 p-3.5 flex items-start gap-3">
          <ShieldCheck size={22} className="text-[#0F4C81] shrink-0 mt-0.5" />
          <div className="text-xs text-slate-800 space-y-1">
            <p className="font-extrabold text-[#0F4C81]">Safe Trading Tips for Buyers</p>
            <p className="text-slate-600 leading-relaxed font-medium">
              • Meet seller in a safe, public location.<br />
              • Inspect and test the item thoroughly before making payment.<br />
              • Never send advance token money before seeing the item.
            </p>
          </div>
        </div>

        {/* Specifications / Highlights */}
        {ad.specs && Object.keys(ad.specs).length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Tag size={16} className="text-[#0F4C81]" />
              Item Specifications
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Object.entries(ad.specs).map(([key, value]) => (
                <div key={key} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <span className="block text-[11px] text-slate-500 font-semibold">{key}</span>
                  <span className="block text-xs sm:text-sm font-bold text-slate-800 truncate mt-0.5">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide mb-2">
            Description from Seller
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium">
            {ad.description || 'No detailed description provided by the seller.'}
          </p>
        </div>

        {/* Seller Profile Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
              Seller Information
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <CheckCircle2 size={12} />
              Verified Seller
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-full overflow-hidden bg-blue-100 shrink-0 border-2 border-[#0F4C81]/30">
              {ad.seller?.avatar ? (
                <img src={ad.seller.avatar} alt={ad.seller.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-[#0F4C81] text-base">
                  {ad.seller?.name?.[0] || 'S'}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900 truncate">
                {ad.seller?.name || 'Private Seller'}
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Member since {ad.seller?.memberSince || '2023'} • {ad.seller?.totalAds || 1} ads active
              </p>
            </div>
          </div>
        </div>

        {/* In-Card Highlighted Chat & Request More Images Action Box */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/70 to-slate-50 rounded-3xl border-2 border-[#0F4C81]/35 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0F4C81] text-white flex items-center justify-center shadow-xs">
                <MessageSquare size={16} />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-slate-900 block leading-tight">
                  Chat with Owner
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {ad.seller?.name || 'Seller'} • Usually replies in minutes
                </span>
              </div>
            </div>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Online
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Connect directly with the owner to bargain price, ask questions, or request additional photographs.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* Highlighted Chat Button */}
            <button
              type="button"
              onClick={handleStartChat}
              className="h-11 rounded-2xl bg-[#0F4C81] hover:bg-[#0A365C] text-white font-black text-xs sm:text-sm shadow-md shadow-[#0F4C81]/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 ring-2 ring-[#0F4C81]/20 cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Chat with Owner</span>
            </button>

            {/* Request More Images Button */}
            <button
              type="button"
              onClick={handleRequestMoreImages}
              className="h-11 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs sm:text-sm border-2 border-emerald-300 hover:border-emerald-400 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
            >
              <ImagePlus size={16} className="text-emerald-700" />
              <span>Request Images</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Sticky Action Bar (Pure Buyer Preview: Request Images | Make an Offer | Chat with Owner) */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-8px_30px_rgba(15,76,129,0.15)] px-3 sm:px-4 py-2.5"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-2">
          {/* 1. Request Images Button (Light Green Background) */}
          <button
            type="button"
            onClick={handleRequestMoreImages}
            className="h-11 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs border border-emerald-300 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs px-2 cursor-pointer text-center"
            title="Request more images from product owner"
          >
            <ImagePlus size={15} className="text-emerald-700 shrink-0" />
            <span className="truncate">Request Images</span>
          </button>

          {/* 2. Make an Offer Button */}
          <button
            type="button"
            onClick={handleOpenOfferModal}
            className="h-11 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold text-xs border border-amber-300 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs px-2 cursor-pointer text-center"
          >
            <Tag size={14} className="text-amber-700 shrink-0" />
            <span className="truncate">Make an Offer</span>
          </button>

          {/* 3. Prominently Highlighted Chat with Owner Button */}
          <button
            type="button"
            onClick={handleStartChat}
            className="h-11 rounded-2xl bg-gradient-to-r from-[#0F4C81] to-[#135996] hover:from-[#0A365C] hover:to-[#0F4C81] text-white font-black text-xs shadow-md shadow-[#0F4C81]/30 transition-all flex items-center justify-center gap-1.5 active:scale-95 ring-2 ring-[#0F4C81]/25 px-2 cursor-pointer text-center"
          >
            <MessageSquare size={15} className="shrink-0" />
            <span className="truncate">Chat with Owner</span>
          </button>
        </div>
      </div>

      {/* Make an Offer Modal */}
      <AnimatePresence>
        {showOfferModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl"
            >
              <h3 className="text-base font-extrabold text-slate-900 mb-1">Make an Offer</h3>
              <p className="text-xs text-slate-500 mb-4">
                Listed price is <strong className="text-slate-800">₹{ad.price?.toLocaleString('en-IN')}</strong>. Bargain directly with the seller!
              </p>

              <form onSubmit={handleMakeOffer} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Offer Amount (₹)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-lg font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      placeholder="e.g. 62000"
                      className="w-full h-12 pl-8 pr-4 rounded-xl border-2 border-[#0F4C81]/30 focus:border-[#0F4C81] focus:ring-4 focus:ring-[#0F4C81]/15 text-lg font-black text-slate-900 outline-hidden"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Offer Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[0.95, 0.9, 0.85].map((discount) => {
                    const quickPrice = Math.round(ad.price * discount);
                    return (
                      <button
                        key={discount}
                        type="button"
                        onClick={() => setOfferAmount(quickPrice)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-xs font-bold text-slate-700 hover:text-[#0F4C81] transition-colors shrink-0"
                      >
                        ₹{quickPrice.toLocaleString('en-IN')}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOfferModal(false)}
                    className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-11 rounded-xl bg-[#0F4C81] hover:bg-[#0A365C] font-bold text-xs text-white shadow-md shadow-[#0F4C81]/30"
                  >
                    Send Offer to Chat
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default C2CProductDetailPage;
