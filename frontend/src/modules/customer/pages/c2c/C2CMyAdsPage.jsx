import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, 
  Eye, MapPin, Sparkles, ExternalLink, Package
} from 'lucide-react';
import { 
  getC2CAds, 
  deleteC2CAd 
} from '../../data/c2cMockData';
import { toast } from 'sonner';

const C2CMyAdsPage = () => {
  const navigate = useNavigate();
  const [allAds, setAllAds] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const ads = getC2CAds();
    setAllAds(ads);
  };

  // Ads created by the user (or sample user ads)
  const myAds = allAds.filter(a => a.isUserAd || a.seller?.id === 'seller-user' || a.id === 'c2c-1');

  const handleDeleteAd = (adId) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      const updated = deleteC2CAd(adId);
      setAllAds(updated);
      toast.success('Listing removed successfully');
    }
  };

  const handleMarkAsSold = (adId) => {
    const updated = allAds.map(a => a.id === adId ? { ...a, status: a.status === 'Sold' ? 'Active' : 'Sold' } : a);
    localStorage.setItem('c2c_marketplace_ads', JSON.stringify(updated));
    setAllAds(updated);
    toast.success('Listing status updated!');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/marketplace/account')}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
              My Listings
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Products you listed for sale ({myAds.length})
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {/* Listings Container */}
        {myAds.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center my-4 shadow-2xs">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-[#0F4C81] flex items-center justify-center mx-auto mb-3 text-2xl">
              <Package size={32} />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              No Active Listings Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4 font-medium leading-relaxed">
              Got an old phone, laptop, bike, or furniture? Post a free listing in 2 minutes and connect with buyers nearby.
            </p>
            <button
              type="button"
              onClick={() => navigate('/marketplace/sell')}
              className="px-6 py-2.5 rounded-xl bg-[#0F4C81] text-white font-extrabold text-xs shadow-md shadow-[#0F4C81]/30 hover:bg-[#0A365C] transition-all cursor-pointer"
            >
              Post Your First Ad (Free)
            </button>
          </div>
        ) : (
          myAds.map((ad) => {
            const isSold = ad.status === 'Sold';
            return (
              <div
                key={ad.id}
                onClick={() => navigate(`/marketplace/my-listings/product?id=${ad.id}`)}
                className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row gap-3.5 relative hover:border-[#0F4C81]/60 hover:shadow-xs transition-all cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="relative w-full sm:w-32 aspect-video sm:aspect-square rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                  <img
                    src={ad.images?.[0] || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400'}
                    alt={ad.title}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isSold ? 'grayscale' : ''}`}
                  />
                  <span className={`absolute top-2 left-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs ${
                    isSold ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {isSold ? 'Sold Out' : 'Active'}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        ₹{ad.price?.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                        <Eye size={13} className="text-slate-400" /> {ad.views || 42} views
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 mb-1 group-hover:text-[#0F4C81] transition-colors">
                      {ad.title}
                    </h4>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-0.5">
                        <MapPin size={12} className="text-slate-400" />
                        {ad.location || ad.city || 'Indore'}
                      </span>
                      <span>•</span>
                      <span>{ad.condition || 'Like New'}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span className="text-slate-500 font-medium">Tap to view details & manage</span>
                    <span className="text-[#0F4C81] font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Manage →
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default C2CMyAdsPage;
