import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { ChevronLeft, ChevronRight, ShoppingBag, Smartphone } from 'lucide-react';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import EmptyRefurbishedCartAnimation from '../components/shared/EmptyRefurbishedCartAnimation';

const CartPage = ({ asOverlay = false, onClose }) => {
    const { groceryCart, refurbishedCart, groceryCartTotal, refurbishedCartTotal } = useCart();
    const navigate = useNavigate();
    const location = useLocation();

    const isRefurbished = location.pathname.startsWith('/refurbished');
    const activeCart = isRefurbished ? refurbishedCart : groceryCart;
    const activeTotal = isRefurbished ? refurbishedCartTotal : groceryCartTotal;

    return (
        <div className={`bg-[#f1f4f8] font-sans ${asOverlay ? 'h-full overflow-y-auto relative pb-28' : 'min-h-screen pb-44 md:pb-28'}`}>
            {/* Header */}
            <div className={`sticky top-0 z-30 px-4 py-4 flex items-center border-b ${
                isRefurbished 
                    ? 'bg-gradient-to-r from-blue-100/95 via-sky-50 to-[#EFF6FF] border-blue-200/60 text-slate-900' 
                    : 'bg-white border-gray-100/50 text-gray-900'
            }`}>
                <button
                    onClick={() => (asOverlay && onClose ? onClose() : (isRefurbished ? navigate('/refurbished') : navigate(-1)))}
                    className="p-1 -ml-1 hover:bg-black/5 rounded-full transition-colors"
                >
                    <ChevronLeft size={24} className="text-gray-900" />
                </button>
                <h1 className="flex-1 text-center text-[18px] font-bold leading-tight mr-6 flex items-center justify-center gap-1.5">
                    {isRefurbished ? (
                        <>
                            <Smartphone size={18} className="text-blue-600" />
                            <span>Refurbished Cart</span>
                        </>
                    ) : (
                        'My Cart'
                    )}
                </h1>
            </div>

            {/* Cart Items */}
            {activeCart.length > 0 ? (
                <div className="px-5 pt-2 space-y-8">
                    {activeCart.map((item) => (
                        <div key={`${item.id}-${item.variantSku || ''}`} className="flex items-center">
                            {/* Image */}
                            <div className="w-[72px] h-[72px] flex-shrink-0 flex items-center justify-center mr-5">
                                <img
                                    src={applyCloudinaryTransform(item.image)}
                                    alt={item.name}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                />
                            </div>

                            {/* Details */}
                            <div className="flex-1">
                                <h3 className="text-[16px] font-bold text-gray-900 leading-tight">
                                    {item.name}
                                </h3>
                                <p className="text-[14px] text-gray-500 font-medium mt-1">
                                    {item.weight || item.refurbishedDetails?.grade || '1 Unit'} {item.quantity > 1 ? `(x${item.quantity})` : ''}
                                </p>
                            </div>

                            {/* Price */}
                            <div className="text-[16px] font-bold text-gray-900 pl-4">
                                ₹{(() => {
                                    const mrp = Number(item.price || 0);
                                    const sale = Number(item.salePrice || 0);
                                    const unit = sale > 0 && sale < mrp ? sale : mrp;
                                    return Math.round(unit * Number(item.quantity || 1));
                                })()}
                            </div>
                        </div>
                    ))}

                    <div className="pt-8 pb-4">
                        {/* Apply Coupon */}
                        <div className="flex items-center justify-between py-4 cursor-pointer">
                            <span className="text-[16px] font-bold text-gray-700">Apply Coupon</span>
                            <ChevronRight size={20} className="text-gray-400" />
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between py-6 mt-2">
                            <span className="text-[22px] font-black text-gray-900">Total</span>
                            <span className="text-[22px] font-black text-gray-900">₹{activeTotal}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <EmptyRefurbishedCartAnimation
                    isRefurbished={isRefurbished}
                    onActionClick={() => {
                        if (asOverlay && onClose) onClose();
                    }}
                />
            )}

            {/* Bottom Fixed Checkout Button */}
            {activeCart.length > 0 && (
                <div className={`${asOverlay ? 'absolute bottom-0' : 'fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0'} left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md z-40 border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]`}>
                    <div className="max-w-md mx-auto">
                        <Link
                            to="/checkout"
                            onClick={onClose}
                            className={`flex w-full items-center justify-center transition-all text-white text-[16px] font-black py-3.5 px-6 rounded-2xl shadow-lg active:scale-[0.99] ${
                                isRefurbished 
                                    ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-600/30'
                                    : 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/30'
                            }`}
                        >
                            Proceed to Checkout
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartPage;
