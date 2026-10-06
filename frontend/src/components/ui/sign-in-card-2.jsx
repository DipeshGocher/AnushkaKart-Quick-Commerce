import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from "@/lib/utils";
import "@/styles/auth-reference.css";

export function SignInCard2({ 
  children, 
  title = "Welcome Back", 
  subtitle = "Sign in to continue", 
  onBack,
  backPath = "/customer",
  showBackButton = true,
  logoUrl = "/logo.png",
  appName = "Anushka Store",
  footer,
  className,
  containerClassName
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
      "auth-reference min-h-screen w-full relative flex items-center justify-center bg-white text-[#171923]",
      containerClassName
    )}>
      <div className="w-full min-h-screen relative flex flex-col justify-center">
          {/* Back / Close button placed lower to avoid dynamic island / notch collision */}
          {showBackButton && (
            <button 
              type="button"
              onClick={handleBack}
              className="absolute left-4 top-12 sm:left-7 sm:top-10 z-30 w-10 h-10 text-[#202833] hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-800 stroke-[2.2]" />
            </button>
          )}

          <div className={cn("auth-reference-content w-full max-w-[480px] sm:max-w-[540px] mx-auto flex flex-col justify-center px-6 sm:px-8 py-12 sm:py-16", className)}>
            <div className="text-center mb-6 sm:mb-8">
              {/* Anushka Store Logo replacing "Welcome here" text */}
              <div className="flex justify-center mb-6 sm:mb-8">
                <img 
                  src={logoUrl || "/logo.png"} 
                  alt={appName || "Anushka Store"} 
                  className="h-11 sm:h-13 w-auto object-contain max-w-[200px]"
                />
              </div>

              {title && (
                <h1 className="text-xl sm:text-2xl font-bold text-[#171923] tracking-tight mb-1.5">
                  {title}
                </h1>
              )}
              
              {subtitle && (
                <p className="text-[#6f737c] text-sm sm:text-base font-normal max-w-sm mx-auto">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Form Content */}
            <div className="relative z-10">
              {children}
            </div>

            {/* Registration Text / Footer placed higher up directly below form */}
            {footer && (
              <div className="auth-reference-footer w-full text-center text-xs sm:text-sm font-medium text-slate-600 mt-6 sm:mt-8">
                {footer}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}

export default SignInCard2;
