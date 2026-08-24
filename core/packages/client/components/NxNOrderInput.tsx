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
};

/** Shared NxN order field used by the simulator and notation explorer. */
export default function NxNOrderInput({ value, onCommit, className, ...rest }: Props) {
  return (
    <NumberCommitInput
      {...rest}
      className={`nxn-order-input${className ? ` ${className}` : ''}`}
      value={clampNxNOrder(value)}
      min={NXN_ORDER_MIN}
      max={NXN_ORDER_MAX}
      step={1}
      inputMode="numeric"
      enterKeyHint="done"
      onCommit={onCommit}
    />
  );
}
