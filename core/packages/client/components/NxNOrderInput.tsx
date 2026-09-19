'use client';

import type { ComponentProps } from 'react';
import NumberCommitInput from '@/components/NumberCommitInput';
import {
  NXN_ORDER_MAX,
  NXN_ORDER_MIN,
  clampNxNOrder,
} from '@/lib/nxn-order';
import './nxn-order-input.css';

type Props = Omit<
  ComponentProps<typeof NumberCommitInput>,
  'value' | 'min' | 'max' | 'onCommit' | 'className'
> & {
  value: number;
  onCommit: (order: number) => void;
  className?: string;
  max?: number;
};

/** Shared NxN order field used by the simulator and notation explorer. */
export default function NxNOrderInput({ value, onCommit, className, max = NXN_ORDER_MAX, ...rest }: Props) {
  const upper = clampNxNOrder(max);
  return (
    <NumberCommitInput
      {...rest}
      className={`nxn-order-input${className ? ` ${className}` : ''}`}
      value={Math.min(upper, clampNxNOrder(value))}
      min={NXN_ORDER_MIN}
      max={upper}
      step={1}
      inputMode="numeric"
      enterKeyHint="done"
      onCommit={onCommit}
    />
  );
}
