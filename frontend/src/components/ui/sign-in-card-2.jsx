import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, User } from 'lucide-react';
import { cn } from "@/lib/utils";

export function SignInCard2({ 
  children, 
  title = "Welcome Back", 
  subtitle = "Sign in to continue", 
  logoUrl = "/logo.png",
  appName = "Anushka Store",
  onBack,
  backPath = "/customer",
  showBackButton = true,
  icon: HeaderIcon = User,
  iconBg = "bg-emerald-50",
  iconColor = "text-emerald-600",
  footer,
  className,
  containerClassName,
  bgImageUrl = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1920&q=80"
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(backPath || '/customer');
    }
  };

  return (
    <div className={cn(
      "min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 py-10 overflow-hidden bg-slate-900",
      containerClassName
    )}>
      {/* Blurred ambient background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center pointer-events-none scale-110 transform-gpu"
        style={{
          backgroundImage: `url('${bgImageUrl}')`,
          filter: 'blur(18px) brightness(0.85)',
        }}
      />
      {/* Subtle translucent overlay for soft contrast and focus on card */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px] pointer-events-none" />

      {/* Main Floating Card Container */}
      <div className="w-full max-w-md relative z-10 my-auto">
        <div className={cn(
          "relative bg-white rounded-[28px] border border-white/60 shadow-[0_25px_60px_rgba(0,0,0,0.28)] overflow-hidden text-slate-900",
          className
        )}>
          {/* Top Orange & Navy Highlight Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#FF5722] via-[#FF6D00] to-[#0F172A]" />

          {/* Top Right Close Button */}
          {showBackButton && (
            <button 
              type="button"
              onClick={handleBack}
              className="absolute right-4 top-4 z-20 w-8 h-8 rounded-full bg-slate-100/90 hover:bg-orange-50 border border-slate-200/80 hover:border-orange-200 text-slate-400 hover:text-orange-600 flex items-center justify-center transition-all active:scale-95 shadow-2xs backdrop-blur-sm cursor-pointer"
              title="Close / Back"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="p-6 sm:p-8">
            {/* Unique Header: Gradient Icon Badge + Title + Subtitle */}
            <div className="text-center mb-6 pt-1">
              {HeaderIcon && (
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3.5 transition-transform hover:scale-105 shadow-lg shadow-orange-500/20 ring-4 ring-[#0F172A]/10",
                  iconBg.includes("gradient") ? iconBg : "bg-gradient-to-br from-[#FF5722] via-[#FF6D00] to-[#0F172A] text-white",
                  iconColor.includes("text-white") ? iconColor : "text-white"
                )}>
                  <HeaderIcon className="w-8 h-8 stroke-[2.2]" />
                </div>
              )}

              {title && (
                <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                  {title}
                </h1>
              )}
              
              {subtitle && (
                <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Form Content */}
            <div className="relative z-10">
              {children}
            </div>
          </div>

          {/* Bottom Card Footer Bar */}
          {footer && (
            <div className="bg-slate-50/60 backdrop-blur-md border-t border-slate-100/80 py-4 px-6 text-center text-xs font-medium text-slate-600">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SignInCard2;
