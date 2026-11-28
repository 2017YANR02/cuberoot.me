import type { ComponentProps } from 'react';
import { Check } from 'lucide-react';

type CopySuccessIconProps = Pick<ComponentProps<typeof Check>, 'size' | 'className' | 'strokeWidth' | 'aria-label'>;

export function CopySuccessIcon({ size = 14, ...props }: CopySuccessIconProps) {
  return <Check {...props} size={size} color="var(--signal-success)" aria-hidden={props['aria-label'] ? undefined : true} />;
}
