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
  className 
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
    <div className="min-h-screen w-full bg-slate-100/90 bg-gradient-to-br from-slate-100 via-sky-50/30 to-slate-200/80 relative flex items-center justify-center p-4 sm:p-6 py-10">
      {/* Background ambient glows for clean separation */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[90vw] max-w-lg h-[40vh] bg-[#0F172A]/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[40vw] max-w-xs h-[30vh] bg-[#FF5722]/15 blur-3xl pointer-events-none rounded-full" />

      {/* Main Floating Card Container */}
      <div className="w-full max-w-md relative z-10 my-auto">
        <div className={cn(
          "relative bg-white rounded-[28px] border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.12)] overflow-hidden text-slate-900",
          className
        )}>
          {/* Top Orange & Navy Highlight Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#FF5722] via-[#FF6D00] to-[#0F172A]" />

          {/* Top Right Close Button */}
          {showBackButton && (
            <button 
              type="button"
              onClick={handleBack}
              className="absolute right-4 top-4 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-orange-50 border border-slate-200/80 hover:border-orange-200 text-slate-400 hover:text-orange-600 flex items-center justify-center transition-all active:scale-95 shadow-2xs"
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
            <div className="bg-slate-50/80 border-t border-slate-100 py-4 px-6 text-center text-xs font-medium text-slate-600">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SignInCard2;
