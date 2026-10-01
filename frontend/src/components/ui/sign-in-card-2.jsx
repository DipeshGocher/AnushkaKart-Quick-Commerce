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
      <div className="w-full min-h-screen relative flex flex-col">
          {showBackButton && (
            <button 
              type="button"
              onClick={handleBack}
              className="absolute left-5 top-7 sm:left-8 sm:top-9 z-20 w-10 h-10 text-[#202833] hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className={cn("auth-reference-content w-full max-w-[680px] mx-auto flex-1 flex flex-col justify-center px-5 sm:px-8 py-24", className)}>
            <div className="text-center mb-8 sm:mb-10">
              <p className="auth-reference-brand text-2xl sm:text-3xl font-bold tracking-tight text-[#172238] mb-16 sm:mb-20">Welcome here</p>

              {title && (
                <h1 className="text-2xl sm:text-3xl font-bold text-[#171923] tracking-tight mb-2">
                  {title}
                </h1>
              )}
              
              {subtitle && (
                <p className="text-[#6f737c] text-base sm:text-lg font-normal max-w-lg mx-auto">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Form Content */}
            <div className="relative z-10">
              {children}
            </div>
          </div>

          {footer && (
            <div className="auth-reference-footer w-full text-center text-sm font-medium text-slate-600 px-5 pb-8">
              {footer}
            </div>
          )}
      </div>
    </div>
  );
}

export default SignInCard2;
