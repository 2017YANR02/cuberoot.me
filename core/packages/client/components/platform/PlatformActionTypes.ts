import type { PlatformActionId, PlatformActionResult, PlatformEntity, PlatformLocaleText, PlatformRouteDefinition } from '@/lib/platform-types';

type FieldKind = 'text' | 'textarea' | 'number' | 'rating' | 'date' | 'datetime-local' | 'tel' | 'url' | 'select' | 'boolean' | 'lines' | 'json' | 'structured' | 'markdown' | 'money';

export interface FieldSpec<Key extends string = string> {
  key: Key;
  label: PlatformLocaleText;
  kind?: FieldKind;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: readonly { value: string; label: PlatformLocaleText }[];
  defaultValue?: string | number | boolean;
  placeholder?: PlatformLocaleText;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface DomainFormSpec {
  title: PlatformLocaleText;
  action: PlatformActionId;
  fields: readonly FieldSpec[];
  submit?: PlatformLocaleText;
  resourceIdField?: string;
  payloadBase?: Readonly<Record<string, unknown>>;
}

export type ContractFields<T> = readonly FieldSpec<Extract<keyof T, string>>[];

export type RunAction = (action: PlatformActionId, id?: string, payload?: Record<string, unknown>) => Promise<PlatformActionResult | undefined>;

export interface CommonProps {
  definition: PlatformRouteDefinition;
  params: Record<string, string>;
  entity?: PlatformEntity;
  entities?: PlatformEntity[];
  busy: string | null;
  runAction: RunAction;
  onSaved?: () => void;
}
