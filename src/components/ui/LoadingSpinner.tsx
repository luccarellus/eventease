import React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'white' | 'black';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className,
  ...props
}) => {
  const config = {
    xs: {
      container: 'w-4 h-4',
      outerBorder: 'border-2',
      innerInset: 'inset-[2px]',
      innerBorder: 'border-2',
    },
    sm: {
      container: 'w-5 h-5',
      outerBorder: 'border-[2.5px]',
      innerInset: 'inset-[3px]',
      innerBorder: 'border-[2.5px]',
    },
    md: {
      container: 'w-8 h-8',
      outerBorder: 'border-3',
      innerInset: 'inset-[4px]',
      innerBorder: 'border-3',
    },
    lg: {
      container: 'w-12 h-12',
      outerBorder: 'border-4',
      innerInset: 'inset-[6px]',
      innerBorder: 'border-4',
    },
    xl: {
      container: 'w-16 h-16',
      outerBorder: 'border-4',
      innerInset: 'inset-2',
      innerBorder: 'border-4',
    },
  };

  const current = config[size] || config.md;

  let topColor = 'border-t-primary';
  let bottomColor = 'border-b-primary';
  let trackColor = 'border-white/10';

  if (variant === 'white') {
    topColor = 'border-t-white';
    bottomColor = 'border-b-white';
    trackColor = 'border-white/20';
  } else if (variant === 'black') {
    topColor = 'border-t-black';
    bottomColor = 'border-b-black';
    trackColor = 'border-black/20';
  }

  return (
    <div
      className={cn(
        'relative inline-block shrink-0',
        current.container,
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'absolute inset-0 rounded-full animate-spin',
          current.outerBorder,
          trackColor,
          topColor
        )}
      />
      <div
        className={cn(
          'absolute rounded-full animate-spin [animation-duration:1.5s] [animation-direction:reverse]',
          current.innerInset,
          current.innerBorder,
          trackColor,
          bottomColor
        )}
      />
    </div>
  );
};

export default LoadingSpinner;
