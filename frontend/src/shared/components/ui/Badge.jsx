import React from 'react';
import { Badge as ShadcnBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const Badge = ({ children, variant = 'gray', className, ...props }) => {
    const variantStyles = {
        primary: 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100',
        success: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
        warning: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
        error: 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100',
        info: 'bg-brand-50 text-brand-700 border-brand-100 hover:bg-brand-100',
        gray: 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100',
    };

    return (
        <ShadcnBadge
            variant="outline"
            className={cn(
                'text-[10px] font-medium transition-colors px-2 py-0.5',
                variantStyles[variant] || variantStyles.gray,
                className
            )}
            {...props}
        >
            {children}
        </ShadcnBadge>
    );
};

export default Badge;
