'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import './training-nav-button.css';

export default function TrainingNavButton({
  direction,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  direction: 'previous' | 'next';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`training-nav-button is-${direction}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {direction === 'previous' && <ArrowLeft size={16} aria-hidden="true" />}
      {children}
      {direction === 'next' && <ArrowRight size={16} aria-hidden="true" />}
    </button>
  );
}
