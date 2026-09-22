import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Camera, Upload, X, CheckCircle2, 
  MapPin, Sparkles, Tag, DollarSign, ImagePlus, Save, AlertCircle
} from 'lucide-react';
import { 
  C2C_CATEGORIES, 
  getC2CAds, 
  updateC2CAd 
} from '../../data/c2cMockData';
import { toast } from 'sonner';

const SAMPLE_PRESET_IMAGES = [
  'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
];

const C2CEditProductPage = () => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const adId = params.id || searchParams.get('id') || searchParams.get('productId');

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('mobiles');
  const [condition, setCondition] = useState('Like New');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('Indore');
  const [images, setImages] = useState([]);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    const ads = getC2CAds();
    let found = null;
    if (adId) {
      found = ads.find(a => String(a.id) === String(adId));
    }
    if (!found) {
      found = ads.find(a => a.isUserAd || a.id === 'c2c-1') || ads[0];
    }

    if (found) {
      setTitle(found.title || '');
      setCategory(found.category || 'mobiles');
      setCondition(found.condition || 'Like New');
      setPrice(found.price ? String(found.price) : '');
      setOriginalPrice(found.originalPrice ? String(found.originalPrice) : '');
      setDescription(found.description || '');
      setLocation(found.location || found.city || 'Indore');
      setCity(found.city || 'Indore');
      setImages(found.images && found.images.length > 0 ? [...found.images] : [SAMPLE_PRESET_IMAGES[0]]);
      setPhone(found.seller?.phone || '+91 98260 12345');
    }
    setLoading(false);
  }, [adId]);

  const handleRemoveImage = (index) => {
    if (images.length <= 1) {
      toast.error('Listing must have at least one photo');
      return;
    }
    setImages(images.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > 6) {
      toast.error('Maximum 6 photos allowed');
      return;
    }

    const newUrls = files.map(file => URL.createObjectURL(file));
    setImages([...images, ...newUrls]);
    toast.success(`${newUrls.length} photo(s) added!`);
  };

  const handleAddPreset = (url) => {
    if (images.includes(url)) return;
    if (images.length >= 6) {
      toast.error('Maximum 6 photos allowed');
      return;
    }
    setImages([...images, url]);
  };

  const handleSetPrimary = (index) => {
    if (index === 0) return;
    const reordered = [...images];
    const [selected] = reordered.splice(index, 1);
    reordered.unshift(selected);
    setImages(reordered);
    toast.success('Cover photo updated');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a listing title');
      return;
    }
    if (!price || Number(price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    if (images.length === 0) {
      toast.error('Please add at least one photo');
      return;
    }

    setIsSubmitting(true);
    const catObj = C2C_CATEGORIES.find(c => c.id === category) || C2C_CATEGORIES[0];

    const updatedFields = {
      title: title.trim(),
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      category,
      categoryName: catObj.name,
      condition,
      location: location.trim() || 'Indore',
      city: city.trim() || 'Indore',
      images,
      description: description.trim(),
      seller: {
        id: 'seller-user',
        name: 'You (Verified Seller)',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        phone,
        verified: true,
      },
      specs: {
        'Category': catObj.name,
        'Condition': condition,
        'Location': location.trim() || 'Indore',
      },
    };

    setTimeout(() => {
      updateC2CAd(adId, updatedFields);
      setIsSubmitting(false);
      toast.success('Listing updated successfully!');
      navigate(`/marketplace/my-listings/product/${adId}`);
    }, 400);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-10 h-10 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 text-slate-900 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/marketplace/my-listings/product/${adId}`)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
              Edit Listing
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Update photos, price, description and specs
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-8 px-3.5 rounded-full bg-[#0F4C81] hover:bg-[#0A365C] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-[#0F4C81]/25 transition-all cursor-pointer disabled:opacity-60"
        >
          <Save size={14} />
          <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Photo Management Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Photos ({images.length}/6)</h2>
              <p className="text-[11px] text-slate-500">First photo will be your main listing cover</p>
            </div>
            <label className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#0F4C81] hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-blue-200 transition-colors">
              <Camera size={14} />
              <span>Add Photo</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Image grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {images.map((img, idx) => (
              <div
                key={idx}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 bg-slate-100 group ${
                  idx === 0 ? 'border-[#0F4C81] ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <img src={img} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 bg-[#0F4C81] text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs">
                    Cover
                  </span>
                )}

                <div className="absolute top-1 right-1 flex items-center gap-1">
                  {idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black text-[9px] font-bold"
                      title="Set as Cover"
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow-xs cursor-pointer"
                    title="Remove Photo"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}

            {images.length < 6 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0F4C81] bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:text-[#0F4C81] cursor-pointer transition-all">
                <ImagePlus size={22} className="mb-1" />
                <span className="text-[10px] font-bold">Upload</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Quick presets */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Or pick preset photos:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {SAMPLE_PRESET_IMAGES.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleAddPreset(preset)}
                  className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 shrink-0 hover:border-[#0F4C81] transition-all"
                >
                  <img src={preset} alt="preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
          <h2 className="text-sm font-extrabold text-slate-900">Listing Information</h2>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Title / Ad Heading <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. iPhone 14 Pro Max 256GB Deep Purple"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
            />
          </div>

          {/* Category & Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
              >
                {C2C_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
              >
                <option value="Brand New">Brand New (Unopened)</option>
                <option value="Like New">Like New (Mint)</option>
                <option value="Good">Good (Minor wear)</option>
                <option value="Fair">Fair (Working condition)</option>
              </select>
            </div>
          </div>

          {/* Price & Original Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selling Price (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="68500"
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Original Price (₹) <span className="text-slate-400 text-[10px] font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  placeholder="139900"
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include details like usage, warranty, reason for selling, accessories included..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
            />
          </div>
        </div>

        {/* Location & Contact */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
          <h2 className="text-sm font-extrabold text-slate-900">Location & Contact</h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Locality / Area
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Vijay Nagar, Palasia..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
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
                placeholder="Indore"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact Phone (displayed to interested buyers)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98260 12345"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
            />
          </div>
        </div>
      </main>

      {/* Fixed Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(`/marketplace/my-listings/product/${adId}`)}
            className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl bg-[#0F4C81] hover:bg-[#0A365C] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#0F4C81]/25 transition-all cursor-pointer disabled:opacity-60"
          >
            <Save size={16} />
            <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default C2CEditProductPage;
