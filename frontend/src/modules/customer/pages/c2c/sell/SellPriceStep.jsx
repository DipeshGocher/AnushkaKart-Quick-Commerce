import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Delete, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const KEYPAD_BUTTONS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '', letters: '', isBlank: true },
  { digit: '0', letters: '' },
  { digit: 'backspace', isBackspace: true },
];

const SellPriceStep = ({
  initialPrice = '',
  onNext,
  onBack,
}) => {
  const [price, setPrice] = useState(initialPrice ? String(initialPrice) : '');
  const inputRef = useRef(null);

  const handleKeyPress = (btn) => {
    if (btn.isBlank) return;

    if (btn.isBackspace) {
      setPrice((prev) => prev.slice(0, -1));
      return;
    }

    if (btn.digit) {
      // Avoid leading zeroes
      if (price === '' && btn.digit === '0') return;
      // Max price 10 digits
      if (price.length >= 9) return;
      setPrice((prev) => prev + btn.digit);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val === '0') return;
    if (val.length <= 9) {
      setPrice(val);
    }
  };

  const formattedPrice = price ? Number(price).toLocaleString('en-IN') : '';

  const handleNext = () => {
    const numericPrice = Number(price);
    if (!numericPrice || numericPrice <= 0) {
      toast.error('Please enter a valid price for your product');
      return;
    }
    if (onNext) {
      onNext(numericPrice);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white flex flex-col font-sans relative">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 h-14 flex items-center relative">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex items-center text-slate-900 font-semibold hover:text-[#0F4C81] active:scale-95 transition-transform z-10"
        >
          <ChevronLeft size={24} strokeWidth={2.4} className="-ml-1" />
          <span className="text-base font-bold ml-0.5">Back</span>
        </button>
        <h1 className="absolute inset-x-0 text-center text-lg font-bold text-slate-900 tracking-tight pointer-events-none">
          Set a price
        </h1>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-4">
        <label className="block text-sm font-bold text-[#0F4C81] mb-2">
          Price
        </label>

        {/* Price Input Container */}
        <div 
          onClick={() => inputRef.current?.focus()}
          className="w-full flex items-center px-3.5 py-3.5 rounded-lg border-2 border-[#0F4C81] bg-white cursor-text transition-all shadow-xs"
        >
          <span className="text-lg font-medium text-slate-700 mr-2 select-none">
            ₹ |
          </span>
          <span className="text-xl font-bold text-slate-900 flex-1 tracking-wide">
            {formattedPrice}
            <span className="inline-block w-0.5 h-6 bg-[#0F4C81] animate-pulse ml-0.5 align-middle" />
          </span>

          {/* Hidden input for physical keyboard entry */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={price}
            onChange={handleInputChange}
            className="sr-only"
            aria-label="Enter price"
          />
        </div>
      </div>

      {/* Bottom Section with Next Button & iOS-Style Numeric Keypad */}
      <div className="mt-auto bg-[#d5d9df] pt-3 pb-6 px-3 border-t border-slate-300 select-none">
        {/* Next Button (Placed right above keypad matching reference image) */}
        <div className="mb-3 px-1">
          <button
            type="button"
            onClick={handleNext}
            className="w-full bg-[#0F4C81] hover:bg-[#0A365C] active:scale-[0.98] text-white font-bold py-3.5 rounded-lg text-base shadow-sm transition-all text-center tracking-wide"
          >
            Next
          </button>
        </div>

        {/* Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-2 px-1">
          {KEYPAD_BUTTONS.map((btn, idx) => {
            if (btn.isBlank) {
              return <div key={idx} className="h-12" />;
            }

            if (btn.isBackspace) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleKeyPress(btn)}
                  className="h-12 flex items-center justify-center bg-transparent active:bg-slate-300/60 rounded-lg transition-colors"
                  aria-label="Backspace"
                >
                  <Delete size={26} className="text-slate-800 stroke-[1.8]" />
                </button>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleKeyPress(btn)}
                className="h-12 bg-white active:bg-slate-200/90 rounded-lg shadow-xs flex flex-col items-center justify-center transition-colors"
              >
                <span className="text-2xl font-medium text-slate-900 leading-none">
                  {btn.digit}
                </span>
                {btn.letters ? (
                  <span className="text-[9px] font-bold text-slate-800 tracking-widest leading-none mt-0.5">
                    {btn.letters}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SellPriceStep;
