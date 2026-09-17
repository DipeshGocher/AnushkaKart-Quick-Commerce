import React, { useState } from 'react';
import { categoryIcons, refurbishedCategoryIcons } from '../constants/categoryIcons';
import { Search, X } from 'lucide-react';
import { motion } from 'framer-motion';

const IconSelector = ({ selectedIcon, onSelect, onClose, electronicsOnly = false, catalogType }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const isElectronics = electronicsOnly || catalogType === "refurbished";
  const sourceIcons = isElectronics ? refurbishedCategoryIcons : categoryIcons;

  const iconComponents = {
    // Electronics & Gadget Icons
    smartphone: "📱",
    laptop: "💻",
    tablet: "📱",
    headphones: "🎧",
    smartwatch: "⌚",
    tv: "📺",
    gamepad: "🎮",
    camera: "📷",
    desktop: "🖥️",
    earbuds: "🎧",
    speaker: "🔊",
    usb: "💾",
    powerbank: "🔋",
    remote: "🎛️",
    microphone: "🎙️",
    webcam: "📹",
    radio: "📻",
    cable: "🔌",
    handheld_game: "👾",
    gadgets: "⚡",

    // General Category Icons
    electronics: "📱",
    fashion: "👕",
    home: "🏠",
    food: "🍔",
    sports: "⚽",
    books: "📚",
    beauty: "💄",
    toys: "🧸",
    automotive: "🚗",
    pets: "🐾",
    health: "💊",
    garden: "🌱",
    office: "💼",
    music: "🎵",
    jewelry: "💎",
    baby: "🍼",
    tools: "🔧",
    luggage: "🧳",
    art: "🎨",
    grocery: "🛒",
    beverages: "🥤",
    dairy: "🥛",
    bakery: "🥐",
    snacks: "🍿",
    meat: "🥩",
    cleaning: "🧹",
    stationery: "✏️",
    festival: "🎉",
  };

  const filteredIcons = sourceIcons.filter(icon =>
    icon.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Select Electronic Category Icon</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isElectronics ? "Electronics & Gadget Icons" : "General Category Icons"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search electronic icons (e.g. mobile, laptop, earbuds, tv)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        {/* Icon Grid */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
            {filteredIcons.map((icon) => (
              <button
                key={icon.id}
                type="button"
                onClick={() => onSelect(icon.id)}
                className={`
                  flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl transition-all duration-300 group
                  ${selectedIcon === icon.id
                    ? 'bg-brand-50 shadow-sm border border-brand-200'
                    : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 hover:shadow-sm'
                  }
                `}
                title={icon.name}>
                <div
                  className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] ${selectedIcon === icon.id
                      ? 'bg-brand-100/50 text-brand-600 scale-110'
                      : 'bg-slate-50 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-500 group-hover:scale-105'
                    }`}
                >
                  {iconComponents[icon.id] ? (
                    <span 
                      className="transition-all duration-300 drop-shadow-sm"
                      style={{
                        fontSize: selectedIcon === icon.id ? '28px' : '24px',
                        filter: selectedIcon === icon.id ? 'none' : 'grayscale(15%) opacity(90%)'
                      }}
                    >
                      {iconComponents[icon.id]}
                    </span>
                  ) : (
                    <div
                      className="w-6 h-6 transition-all duration-300"
                      dangerouslySetInnerHTML={{ __html: icon.svg }}
                    />
                  )}
                </div>
                <span className={`text-[11px] sm:text-xs mt-3 text-center line-clamp-1 font-semibold transition-colors duration-300 ${
                  selectedIcon === icon.id ? 'text-brand-700' : 'text-slate-600'
                }`}>
                  {icon.name}
                </span>
              </button>
            ))}
          </div>

          {filteredIcons.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No electronic icons found matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          {selectedIcon ? (
            <button
              type="button"
              onClick={() => {
                onSelect("");
                onClose();
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5">
              <X className="w-4 h-4" />
              Remove Selected Icon
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium transition-colors text-sm">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default IconSelector;
