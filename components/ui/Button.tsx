import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
}

export function Button({
  title,
  loading = false,
  variant = 'primary',
  disabled,
  className,
  ...props
}: ButtonProps) {
  const baseClasses =
    'flex-row items-center justify-center rounded-xl px-6 py-4';

  const variantClasses = {
    primary: 'bg-accent',
    outline: 'border border-border bg-transparent',
    ghost: 'bg-transparent',
  };

  const textClasses = {
    primary: 'text-background font-semibold text-base',
    outline: 'text-text-primary font-semibold text-base',
    ghost: 'text-accent font-semibold text-base',
  };

  return (
    <TouchableOpacity
      className={`${baseClasses} ${variantClasses[variant]} ${disabled || loading ? 'opacity-50' : ''} ${className ?? ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#0A0A0A' : '#34D399'}
          size="small"
        />
      ) : (
        <Text className={textClasses[variant]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
