import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Camera, Upload, X, CheckCircle2, 
  MapPin, Sparkles, Tag, ShieldCheck, DollarSign,
  ChevronRight, Info
} from 'lucide-react';
import { C2C_CATEGORIES, addC2CAd } from '../../data/c2cMockData';
import { toast } from 'sonner';

const SAMPLE_PRESET_IMAGES = [
  'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
];

const C2CSellPage = () => {
  const navigate = useNavigate();

  const [category, setCategory] = useState('mobiles');
  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('Like New');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Vijay Nagar, Indore');
  const [city, setCity] = useState('Indore');
  const [images, setImages] = useState([SAMPLE_PRESET_IMAGES[0]]);
  const [sellerName, setSellerName] = useState('You (Verified)');
  const [sellerPhone, setSellerPhone] = useState('+91 98260 12345');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick preset image addition
  const handleAddPresetImage = (url) => {
    if (images.includes(url)) return;
    if (images.length >= 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }
    setImages([...images, url]);
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Convert to mock ObjectURLs for immediate preview
    const newUrls = files.slice(0, 5 - images.length).map(f => URL.createObjectURL(f));
    setImages([...images, ...newUrls]);
    toast.success(`${newUrls.length} photo(s) added!`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter an Ad title');
      return;
    }
    if (!price || Number(price) <= 0) {
      toast.error('Please enter a valid selling price');
      return;
    }
    if (images.length === 0) {
      toast.error('Please add at least one photo of your item');
      return;
    }

    setIsSubmitting(true);

    const catObj = C2C_CATEGORIES.find(c => c.id === category) || C2C_CATEGORIES[0];

    const newAd = {
      title: title.trim(),
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      category,
      categoryName: catObj.name,
      condition,
      location: location.trim() || 'Indore',
      city: city.trim() || 'Indore',
      images,
      description: description.trim() || 'Genuine pre-owned item in working condition. Price negotiable.',
      seller: {
        id: 'seller-user',
        name: sellerName || 'Customer Seller',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        memberSince: 'Sep 2024',
        verified: true,
        phone: sellerPhone,
        rating: 5.0,
        totalAds: 1,
      },
      specs: {
        'Category': catObj.name,
        'Condition': condition,
        'Location': location,
      },
      isElite: false,
    };

    setTimeout(() => {
      const created = addC2CAd(newAd);
      setIsSubmitting(false);
      toast.success('Your ad is live! Buyers in your city can now see it and send offers.');
      navigate(`/marketplace/my-ads`);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] pb-28 text-slate-900 font-sans">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <h1 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
          Post Your Ad (Free)
        </h1>

        <div className="w-9" />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Banner with Classic Blue #0F4C81 */}
        <div className="bg-gradient-to-r from-[#0F4C81] to-[#0A365C] rounded-2xl p-4 text-white mb-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={13} /> Free C2C Marketplace Listing
            </span>
            <h2 className="text-base font-extrabold mt-0.5">Sell directly to genuine buyers</h2>
            <p className="text-xs text-blue-100 font-medium">Zero commission. Receive offers instantly on chat.</p>
          </div>
          <span className="text-3xl">📦</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Category */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wide mb-2">
              1. Choose Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {C2C_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                    category === cat.id
                      ? 'bg-blue-50 border-[#0F4C81] text-[#0F4C81] shadow-xs font-bold'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-xs truncate">{cat.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Photos */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
                2. Upload Photos ({images.length}/5)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Clear photos get 3x faster buyers</span>
            </div>

            {/* Photo preview list */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mb-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group">
                  <img src={img} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 bg-[#0F4C81] text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded">
                      Cover
                    </span>
                  )}
                </div>
              ))}

              {/* Upload trigger */}
              {images.length < 5 && (
                <label className="aspect-square rounded-2xl border-2 border-dashed border-[#0F4C81]/40 hover:border-[#0F4C81] bg-blue-50/30 hover:bg-blue-50/60 flex flex-col items-center justify-center cursor-pointer transition-colors p-2 text-center">
                  <Camera size={22} className="text-[#0F4C81] mb-1" />
                  <span className="text-[10px] font-bold text-[#0F4C81] leading-tight">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Quick Demo Photo Presets */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                Or pick a quick sample photo for demo:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {SAMPLE_PRESET_IMAGES.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAddPresetImage(url)}
                    className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 hover:scale-105 transition-transform"
                    title="Add sample"
                  >
                    <img src={url} alt="Preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3: Details */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
              3. Item Details
            </label>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ad Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. iPhone 13 128GB Midnight (Bill + Box available)"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#0F4C81] focus:ring-4 focus:ring-[#0F4C81]/15 text-sm font-medium outline-hidden"
                maxLength={70}
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block text-right">{title.length}/70</span>
            </div>

            {/* Condition Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Physical Condition *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['Brand New', 'Like New', 'Good', 'Fair'].map((cond) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => setCondition(cond)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition-all ${
                      condition === cond
                        ? 'bg-[#0F4C81] text-white border-[#0F4C81] shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selling Price (₹) *
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-base font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 28000"
                    className="w-full h-11 pl-8 pr-3 rounded-xl border border-slate-300 focus:border-[#0F4C81] focus:ring-4 focus:ring-[#0F4C81]/15 text-sm font-black text-slate-900 outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Original MRP / Purchase Price (Optional)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-base font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="e.g. 59999"
                    className="w-full h-11 pl-8 pr-3 rounded-xl border border-slate-300 focus:border-[#0F4C81] focus:ring-4 focus:ring-[#0F4C81]/15 text-sm font-semibold text-slate-700 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description & Inclusions
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mention inclusions (charger, original box, bill), reason for selling, any minor scratch, battery health..."
                className="w-full p-3 rounded-xl border border-slate-300 focus:border-[#0F4C81] focus:ring-4 focus:ring-[#0F4C81]/15 text-sm font-medium outline-hidden"
              />
            </div>
          </div>

          {/* Step 4: Location & Seller */}
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wide">
              4. Location & Contact
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Locality / Landmark
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Vijay Nagar, 56 Dukan"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#0F4C81] text-sm font-medium outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Indore"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 focus:border-[#0F4C81] text-sm font-medium outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-13 rounded-2xl bg-[#0F4C81] hover:bg-[#0A365C] text-white font-extrabold text-base shadow-lg shadow-[#0F4C81]/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Post Ad Now
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2 font-medium">
              By posting, you agree to C2C community guidelines and honest product disclosures.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default C2CSellPage;
