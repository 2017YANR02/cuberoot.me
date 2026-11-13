'use client';

import { useEffect, useState } from 'react';
import { loadPlatformShippingAddresses } from '@/lib/platform-gateway';
import type { PlatformEntity } from '@/lib/platform-types';
import { PlatformState } from './PlatformState';
import { type RunAction, type CommonProps } from './PlatformActionTypes';
import { text, SHIPPING_ADDRESS_FIELDS } from './PlatformFormDefinitions';
import { DomainForm, ActionButton } from './PlatformForm';

export function PlatformShippingAddressManager({ definition, busy, runAction, onAddresses }: CommonProps & {
  onAddresses?: (addresses: PlatformEntity[]) => void;
}) {
  const [addresses, setAddresses] = useState<PlatformEntity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void loadPlatformShippingAddresses(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setAddresses(result.items);
      onAddresses?.(result.items);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });
    return () => controller.abort();
  }, [onAddresses, revision]);
  const refreshingAction: RunAction = async (...args) => {
    const actionResult = await runAction(...args);
    setRevision((value) => value + 1);
    return actionResult;
  };
  return (
    <section className="platform-domain-actions">
      {error ? <PlatformState kind="error" message={error.message} onRetry={() => setRevision((value) => value + 1)} /> : addresses === null ? <PlatformState kind="loading" /> : (
        <div className="platform-domain-stack">
          {addresses.map((address) => (
            <div className="platform-course-editor-item" key={address.id}>
              <DomainForm definition={definition} entity={address} resourceId={address.id} busy={busy} runAction={refreshingAction} spec={{ title: text(`编辑地址：${address.title}`, `Edit address: ${address.title}`), action: 'save-shipping-address', fields: SHIPPING_ADDRESS_FIELDS }} />
              <ActionButton action="delete-shipping-address" resourceId={address.id} confirm={text('确定删除这个收货地址吗？', 'Delete this shipping address?')} busy={busy} runAction={refreshingAction} />
            </div>
          ))}
          <DomainForm definition={definition} busy={busy} runAction={refreshingAction} spec={{ title: text('新建收货地址', 'Add shipping address'), action: 'save-shipping-address', fields: SHIPPING_ADDRESS_FIELDS }} />
        </div>
      )}
    </section>
  );
}
