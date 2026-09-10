import * as React from 'react';
import { useState, useCallback } from 'react';
import { cn } from "@/lib/utils";
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff,  
  Shield,
  AlertTriangle,
  KeyRound,
  Phone,
  Loader2,
} from 'lucide-react';

const calculatePasswordStrength = (password) => {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
  };

  const score = Object.values(requirements).filter(Boolean).length;
  const feedback = [];

  if (!requirements.length) feedback.push('At least 8 characters');
  if (!requirements.uppercase) feedback.push('One uppercase letter');
  if (!requirements.lowercase) feedback.push('One lowercase letter');
  if (!requirements.number) feedback.push('One number');
  if (!requirements.special) feedback.push('One special character');

  return { score, feedback, requirements };
};

const PasswordStrengthIndicator = ({ password }) => {
  const strength = calculatePasswordStrength(password);
  
  const getStrengthColor = (score) => {
    if (score <= 1) return 'text-rose-500';
    if (score <= 2) return 'text-amber-500';
    if (score <= 3) return 'text-yellow-500';
    if (score <= 4) return 'text-blue-500';
    return 'text-emerald-500';
  };

  const getStrengthText = (score) => {
    if (score <= 1) return 'Very Weak';
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Fair';
    if (score <= 4) return 'Good';
    return 'Strong';
  };

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2 animate-in fade-in-50 slide-in-from-bottom-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
          <div
            className={`h-full ${getStrengthColor(strength.score)} bg-current rounded-full transition-all duration-300`}
            style={{ width: `${(strength.score / 5) * 100}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 font-semibold min-w-[60px]">
          {getStrengthText(strength.score)}
        </span>
      </div>
      {strength.feedback.length > 0 && (
        <div className="grid grid-cols-2 gap-1">
          {strength.feedback.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-1 text-xs text-amber-600 font-medium"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export function AuthForm({
  onSuccess,
  onClose,
  initialMode = 'login',
  className,
}) {
  const [authMode, setAuthMode] = useState(initialMode);
  const [registrationStep, setRegistrationStep] = useState('details');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    agreeToTerms: false,
    rememberMe: false,
    verificationCode: '',
  });
  const [errors, setErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});

  React.useEffect(() => {
    const savedEmail = localStorage.getItem('userEmail');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    if (savedEmail && authMode === 'login') {
      setFormData(prev => ({ ...prev, email: savedEmail, rememberMe }));
    }
  }, [authMode]);

  const validateField = useCallback((field, value) => {
    let error = '';
    
    switch (field) {
      case 'name':
        if (typeof value === 'string' && authMode === 'signup' && !value.trim()) {
          error = 'Name is required';
        }
        break;
        
      case 'email':
        if (!value || (typeof value === 'string' && !value.trim())) {
          error = 'Email is required';
        } else if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;
        
      case 'password':
        if (!value) {
          error = 'Password is required';
        } else if (typeof value === 'string') {
          if (value.length < 8) {
            error = 'Password must be at least 8 characters';
          } else if (authMode === 'signup') {
            const strength = calculatePasswordStrength(value);
            if (strength.score < 3) {
              error = 'Password is too weak';
            }
          }
        }
        break;
        
      case 'confirmPassword':
        if (authMode === 'signup' && value !== formData.password) {
          error = 'Passwords do not match';
        }
        break;
        
      case 'phone':
        if (typeof value === 'string' && value && !/^\+?[\d\s\-()]+$/.test(value)) {
          error = 'Please enter a valid phone number';
        }
        break;
        
      case 'verificationCode':
        if (typeof value === 'string' && authMode === 'signup' && registrationStep === 'verification' && !/^\d{6}$/.test(value)) {
          error = 'Verification code must be 6 digits';
        }
        break;
        
      case 'agreeToTerms':
        if (authMode === 'signup' && !value) {
          error = 'You must agree to the terms and conditions';
        }
        break;
    }
    
    return error;
  }, [formData.password, authMode, registrationStep]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (fieldTouched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error || undefined }));
    }
  }, [fieldTouched, validateField]);

  const handleFieldBlur = useCallback((field) => {
    setFieldTouched(prev => ({ ...prev, [field]: true }));
    const value = formData[field];
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error || undefined }));
  }, [formData, validateField]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    const fieldsToValidate = ['email', 'password'];
    
    if (authMode === 'signup') {
      fieldsToValidate.push('name', 'confirmPassword', 'agreeToTerms');
    }
    
    if (registrationStep === 'verification') {
      fieldsToValidate.push('verificationCode');
    }

    fieldsToValidate.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [authMode, registrationStep, formData, validateField]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (authMode === 'login') {
        if (formData.rememberMe) {
          localStorage.setItem('userEmail', formData.email);
          localStorage.setItem('rememberMe', 'true');
        }
        
        setSuccessMessage('Login successful');
        onSuccess?.({ email: formData.email });
        
      } else if (authMode === 'signup') {
        if (registrationStep === 'details') {
          setRegistrationStep('verification');
          setSuccessMessage('Account created! Please verify your email.');
        } else if (registrationStep === 'verification') {
          setRegistrationStep('complete');
          setSuccessMessage('Email verified successfully!');
          onSuccess?.({ email: formData.email, name: formData.name });
        }
        
      } else if (authMode === 'reset') {
        setSuccessMessage('Password reset email sent!');
        setTimeout(() => setAuthMode('login'), 2000);
      }
      
    } catch (error) {
      setErrors({ 
        general: 'Authentication failed. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderAuthContent = () => {
    if (authMode === 'reset') {
      return (
        <div className="space-y-4 animate-in fade-in-50 slide-in-from-right-5">
          <div className="text-center mb-6">
            <KeyRound className="h-12 w-12 text-[#E60067] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Password Recovery</h3>
            <p className="text-slate-500 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <div>
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                onBlur={() => handleFieldBlur('email')}
                className={cn(
                  "w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all",
                  errors.email ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
                aria-label="Email Address"
              />
              {errors.email && (
                <p className="text-rose-500 text-xs mt-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !formData.email}
            className={cn(
              "w-full relative bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg",
              "hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <KeyRound className="h-5 w-5" />
                  Send Reset Link
                </>
              )}
            </span>
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className="text-[#E60067] hover:text-[#C00052] text-sm font-semibold transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    if (authMode === 'signup' && registrationStep === 'verification') {
      return (
        <div className="space-y-4 animate-in fade-in-50 slide-in-from-right-5">
          <div className="text-center mb-6">
            <Mail className="h-12 w-12 text-[#E60067] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Verify Your Email</h3>
            <p className="text-slate-500 text-sm">
              We've sent a 6-digit code to <span className="font-bold text-slate-800">{formData.email}</span>
            </p>
          </div>

          <div>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={formData.verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  handleInputChange('verificationCode', value);
                }}
                onBlur={() => handleFieldBlur('verificationCode')}
                className={cn(
                  "w-full text-center py-3.5 px-4 bg-slate-50 border rounded-xl text-2xl font-mono font-bold tracking-widest text-slate-800 placeholder:text-slate-300 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all",
                  errors.verificationCode ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
                maxLength={6}
              />
              {errors.verificationCode && (
                <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1 justify-center font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.verificationCode}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || formData.verificationCode.length !== 6}
            className={cn(
              "w-full relative bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg",
              "hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <span className="flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Email"}
            </span>
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setRegistrationStep('details')}
              className="text-[#E60067] hover:text-[#C00052] text-sm font-semibold transition-colors"
            >
              Back to Details
            </button>
          </div>
        </div>
      );
    }

    if (authMode === 'signup' && registrationStep === 'complete') {
      return (
        <div className="text-center space-y-6 animate-in fade-in-50 slide-in-from-right-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Welcome Aboard!</h3>
            <p className="text-slate-500 text-sm">
              Your account has been created successfully.
            </p>
          </div>

          <button
            onClick={onClose}
            className={cn(
              "w-full bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl shadow-md",
              "hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99]"
            )}
          >
            Get Started
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-in fade-in-50 slide-in-from-right-5">
        {authMode === 'signup' && (
          <div>
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
              <input
                type="text"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={() => handleFieldBlur('name')}
                className={cn(
                  "w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all",
                  errors.name ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
                aria-label="Full Name"
              />
              {errors.name && (
                <p className="text-rose-500 text-xs mt-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.name}
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
            <input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onBlur={() => handleFieldBlur('email')}
              className={cn(
                "w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all",
                errors.email ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
              )}
              aria-label="Email Address"
            />
            {errors.email && (
              <p className="text-rose-500 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {errors.email}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              onBlur={() => handleFieldBlur('password')}
              className={cn(
                "w-full pl-11 pr-12 py-3.5 bg-slate-50 border rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all",
                errors.password ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
              )}
              aria-label="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
            {errors.password && (
              <p className="text-rose-500 text-xs mt-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {errors.password}
              </p>
            )}
          </div>
          {authMode === 'signup' && (
            <PasswordStrengthIndicator password={formData.password} />
          )}
        </div>

        {authMode === 'signup' && (
          <div>
            <div className="relative group">
              <Shield className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                onBlur={() => handleFieldBlur('confirmPassword')}
                className={cn(
                  "w-full pl-11 pr-12 py-3.5 bg-slate-50 border rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all",
                  errors.confirmPassword ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
                aria-label="Confirm Password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
              {errors.confirmPassword && (
                <p className="text-rose-500 text-xs mt-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>
        )}

        {authMode === 'signup' && (
          <div>
            <div className="relative group">
              <Phone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
              <input
                type="tel"
                placeholder="Phone Number (Optional)"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                onBlur={() => handleFieldBlur('phone')}
                className={cn(
                  "w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all",
                  errors.phone ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                )}
                aria-label="Phone Number"
              />
              {errors.phone && (
                <p className="text-rose-500 text-xs mt-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.phone}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          {authMode === 'login' ? (
            <>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#E60067] focus:ring-[#E60067] accent-[#E60067]"
                />
                <span className="text-xs font-semibold text-slate-600">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setAuthMode('reset')}
                className="text-xs font-bold text-[#E60067] hover:text-[#C00052] transition-colors"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#E60067] focus:ring-[#E60067] accent-[#E60067]"
              />
              <span className="text-xs text-slate-500 leading-relaxed font-medium">
                I agree to the{' '}
                <a href="#" className="text-[#E60067] font-bold hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-[#E60067] font-bold hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>
          )}
        </div>

        {errors.agreeToTerms && (
          <p className="text-rose-500 text-xs flex items-center gap-1 font-medium">
            <AlertTriangle className="h-3 w-3" />
            {errors.agreeToTerms}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "w-full relative bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg",
            "hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <span className="flex items-center justify-center gap-2">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              authMode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div 
      className={cn("bg-white text-slate-900 border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto relative overflow-hidden", className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
    >
      {/* Background accents */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100/40 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-100/30 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 animate-in fade-in-0 slide-in-from-top-5">
          <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-700 text-xs font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {errors.general && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 animate-in fade-in-0 slide-in-from-top-5">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span className="text-rose-700 text-xs font-semibold">{errors.general}</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6 relative z-10">
        <h2 
          id="auth-title"
          className="text-2xl font-bold text-slate-900 tracking-tight mb-1.5"
        >
          {authMode === 'login' ? 'Welcome Back' : 
           authMode === 'reset' ? 'Reset Password' : 'Create Account'}
        </h2>
        <p className="text-slate-500 text-xs font-medium">
          {authMode === 'login' ? 'Sign in to your account' : 
           authMode === 'reset' ? 'Recover your account access' :
           'Create a new account'}
        </p>
      </div>

      {/* Mode Toggle Tabs */}
      {authMode !== 'reset' && (
        <div className="flex bg-slate-100/90 p-1.5 rounded-2xl mb-6 border border-slate-200/50 relative z-10">
          <button
            onClick={() => setAuthMode('login')}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all",
              authMode === 'login'
                ? "bg-white text-[#E60067] shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
            type="button"
          >
            Login
          </button>
          <button
            onClick={() => {
              setAuthMode('signup');
              setRegistrationStep('details');
            }}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all",
              authMode === 'signup'
                ? "bg-white text-[#E60067] shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
            type="button"
          >
            Sign Up
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="relative z-10">
        {renderAuthContent()}
      </form>

      {/* Toggle at bottom */}
      {authMode !== 'reset' && registrationStep === 'details' && (
        <div className="text-center mt-6 relative z-10">
          <p className="text-slate-500 text-xs font-medium">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-[#E60067] hover:text-[#C00052] font-bold transition-colors"
            >
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}

export default AuthForm;
