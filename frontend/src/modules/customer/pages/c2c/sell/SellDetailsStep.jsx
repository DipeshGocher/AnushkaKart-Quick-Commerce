import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, Check, CheckCircle2, Search, X } from 'lucide-react';
import { CATEGORY_BRANDS } from './sellDraftStore';
import { toast } from 'sonner';

const SellDetailsStep = ({
  category,
  subCategory,
  initialData,
  onNext,
  onBack,
}) => {
  const catKey = category?.id || 'mobiles';
  const availableBrands = CATEGORY_BRANDS[catKey] || CATEGORY_BRANDS.mobiles;

  const [brand, setBrand] = useState(initialData?.brand || '');
  const [customBrand, setCustomBrand] = useState('');
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');

  const filteredBrands = availableBrands.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const handleSelectBrand = (selected) => {
    setBrand(selected);
    setIsBrandModalOpen(false);
    setBrandSearch('');
  };

  const handleCustomBrandSubmit = (e) => {
    e.preventDefault();
    if (customBrand.trim()) {
      setBrand(customBrand.trim());
      setIsBrandModalOpen(false);
      setCustomBrand('');
      setBrandSearch('');
    }
  };

  const handleNext = () => {
    if (!brand || !brand.trim()) {
      toast.error('Please select a brand');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter an Ad title');
      return;
    }
    onNext({
      brand,
      title: title.trim(),
      description: description.trim(),
    });
  };

  return (
    <div className="w-full min-h-screen bg-white flex flex-col font-sans relative">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 h-14 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-1 -ml-1 text-slate-800 hover:text-slate-900 active:scale-95 transition-transform"
        >
          <ChevronLeft size={28} strokeWidth={2.4} />
        </button>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight flex-1 text-center pr-7">
          Include some details
        </h1>
      </header>

      {/* Main Content Form */}
      <div className="w-full flex-1 p-4 pb-28 space-y-6">
        {/* Brand Field */}
        <div>
          <label className="block text-sm font-semibold text-[#0F4C81] mb-1.5">
            Brand*
          </label>
          <button
            type="button"
            onClick={() => setIsBrandModalOpen(true)}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-left focus:outline-none transition-all shadow-xs ${
              brand 
                ? 'border-2 border-[#0F4C81] bg-white' 
                : 'border border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            <span className={`text-base ${brand ? 'font-semibold text-slate-900' : 'text-slate-400 font-normal'}`}>
              {brand || 'Select a Brand'}
            </span>
            <div className="flex items-center gap-1.5">
              {brand ? <CheckCircle2 size={18} strokeWidth={2.5} className="text-[#0F4C81]" /> : null}
              <ChevronDown size={20} strokeWidth={2} className={brand ? 'text-[#0F4C81]' : 'text-slate-400'} />
            </div>
          </button>
        </div>

        {/* Ad Title Field */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1.5">
            Ad title*
          </label>
          <input
            type="text"
            maxLength={70}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Key features of your item"
            className="w-full px-3.5 py-3 rounded-lg border border-slate-400/80 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] text-slate-900 placeholder:text-slate-400 text-base focus:outline-none transition-colors"
          />
          <div className="flex justify-end mt-1 text-xs text-slate-500 font-medium">
            {title.length}/70
          </div>
        </div>

        {/* Additional Information Field */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-1.5">
            Additional information*
          </label>
          <textarea
            rows={5}
            maxLength={4096}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Include condition, features and reasons for selling"
            className="w-full px-3.5 py-3 rounded-lg border border-slate-400/80 focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] text-slate-900 placeholder:text-slate-400 text-base focus:outline-none transition-colors resize-none leading-relaxed"
          />
          <div className="flex justify-end mt-1 text-xs text-slate-500 font-medium">
            {description.length}/4096
          </div>
        </div>
      </div>

      {/* Pinned Bottom Next Button (OLX Style) */}
      <div className="fixed bottom-0 left-0 right-0 w-full p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200/80 z-40">
        <button
          type="button"
          onClick={handleNext}
          className="w-full bg-[#0F4C81] hover:bg-[#0A365C] active:scale-[0.98] text-white font-bold py-3.5 rounded-lg text-base shadow-sm transition-all text-center tracking-wide"
        >
          Next
        </button>
      </div>

      {/* Brand Selection Modal / Bottom Sheet */}
      {isBrandModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div 
            className="w-full max-w-lg mx-auto bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Select Brand</h3>
              <button
                type="button"
                onClick={() => setIsBrandModalOpen(false)}
                className="p-1 rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search brand..."
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 focus:bg-white focus:border-[#0F4C81] text-sm focus:outline-none"
                />
              </div>
            </div>

            {/* Brands List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-1">
              {filteredBrands.map((b) => {
                const isSelected = brand === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleSelectBrand(b)}
                    className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-blue-50/50 transition-colors"
                  >
                    <span className={`text-base ${isSelected ? 'font-bold text-[#0F4C81]' : 'text-slate-800'}`}>
                      {b}
                    </span>
                    {isSelected && (
                      <Check size={20} className="text-[#0F4C81]" strokeWidth={2.6} />
                    )}
                  </button>
                );
              })}

              {/* Custom Brand Entry */}
              <div className="p-4 bg-slate-50 mt-2">
                <p className="text-xs text-slate-500 mb-2 font-medium">Or enter custom brand:</p>
                <form onSubmit={handleCustomBrandSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter brand name"
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white rounded-lg border border-slate-300 focus:border-[#0F4C81] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0F4C81] text-white text-sm font-semibold rounded-lg hover:bg-[#0A365C]"
                  >
                    Apply
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellDetailsStep;
