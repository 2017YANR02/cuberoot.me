'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Lock, Plus, Save, Search, Trash2, UserPlus, X } from 'lucide-react';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import { SearchInput } from '@/components/SearchInput';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { useAuthStore, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import {
  createVaultKeyProfile,
  decryptVaultEntry,
  encryptVaultEntry,
  unlockVaultPrivateKey,
  type EncryptedPrivateKey,
  type VaultEntry,
} from '@/lib/vault-crypto';
import './vault.css';

interface VaultShare { userId: number; name: string; publicKey: JsonWebKey; }
interface VaultItemPayload {
  id: string; ownerUserId: number; ownerName: string; ciphertext: string; iv: string;
  version: number; updatedAt: string; wrappedKey: string; shares: VaultShare[];
}
interface VaultPayload {
  userId: number;
  keyProfile: { publicKey: JsonWebKey; encryptedPrivateKey: EncryptedPrivateKey } | null;
  items: VaultItemPayload[];
}
interface OpenItem {
  localId: string; serverId: string | null; ownerUserId: number; ownerName: string;
  version: number; updatedAt: string; shares: VaultShare[]; entry: VaultEntry;
}
interface UserResult { userId: number; name: string; wcaId: string | null; publicKey: JsonWebKey | null; }

const cloneItem = (item: OpenItem): OpenItem => structuredClone(item);
const emptyEntry = (): VaultEntry => ({ id: crypto.randomUUID(), title: '', fields: [], notes: '' });

export default function VaultPage() {
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const login = useAuthStore((state) => state.login);
  const { copiedKey, copy } = useCopy();
  const [mounted, setMounted] = useState(false);
  const [payload, setPayload] = useState<VaultPayload | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [draft, setDraft] = useState<OpenItem | null>(null);
  const [dirty, setDirty] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [filter, setFilter] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [shareQuery, setShareQuery] = useState('');
  const [shareResults, setShareResults] = useState<UserResult[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);
    void fetch(apiUrl('/v1/vault'), { headers: authHeaders(false) })
      .then((response) => handleApi<VaultPayload>(response))
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch(() => { if (!cancelled) setError(tr({ zh: '资料库加载失败，请稍后重试。', en: 'Could not load the vault. Try again later.' })); });
    return () => { cancelled = true; };
  }, [user]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const visibleItems = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase();
    return q ? items.filter((item) => item.entry.title.toLocaleLowerCase().includes(q)) : items;
  }, [filter, items]);

  const openVault = async (key: CryptoKey, data: VaultPayload) => {
    const results = await Promise.allSettled(data.items.map(async (item): Promise<OpenItem> => ({
      localId: item.id,
      serverId: item.id,
      ownerUserId: item.ownerUserId,
      ownerName: item.ownerName,
      version: item.version,
      updatedAt: item.updatedAt,
      shares: item.shares,
      entry: await decryptVaultEntry(item.ciphertext, item.iv, item.wrappedKey, key),
    })));
    const opened = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    setPrivateKey(key);
    setItems(opened);
    setDraft(opened[0] ? cloneItem(opened[0]) : null);
    setFailedCount(results.length - opened.length);
    setDirty(false);
    setPassphrase('');
  };

  const setup = async (event: FormEvent) => {
    event.preventDefault();
    if (!payload || passphrase.length < 12) {
      setError(tr({ zh: '解锁口令至少需要 12 个字符。', en: 'Use at least 12 characters for the vault passphrase.' }));
      return;
    }
    if (passphrase !== confirmation) {
      setError(tr({ zh: '两次输入的口令不一致。', en: 'The passphrases do not match.' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const keyProfile = await createVaultKeyProfile(passphrase);
      await handleApi(await fetch(apiUrl('/v1/vault/key'), { method: 'PUT', headers: authHeaders(), body: JSON.stringify(keyProfile) }));
      const next = { ...payload, keyProfile };
      setPayload(next);
      await openVault(await unlockVaultPrivateKey(passphrase, keyProfile.encryptedPrivateKey), next);
      setConfirmation('');
    } catch {
      setError(tr({ zh: '无法初始化资料库，请稍后重试。', en: 'Could not initialize the vault. Try again later.' }));
    } finally { setBusy(false); }
  };

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!payload?.keyProfile) return;
    setBusy(true);
    setError(null);
    try {
      await openVault(await unlockVaultPrivateKey(passphrase, payload.keyProfile.encryptedPrivateKey), payload);
    } catch {
      setError(tr({ zh: '口令不正确，或加密资料已损坏。', en: 'The passphrase is wrong or the encrypted data is damaged.' }));
    } finally { setBusy(false); }
  };

  const confirmDiscard = () => !dirty || window.confirm(tr({ zh: '放弃尚未保存的修改？', en: 'Discard unsaved changes?' }));
  const discardUnsavedNew = () => {
    if (draft && !draft.serverId) setItems((current) => current.filter((item) => item.localId !== draft.localId));
  };
  const selectItem = (item: OpenItem) => {
    if (!confirmDiscard()) return;
    discardUnsavedNew();
    setDraft(cloneItem(item));
    setDirty(false);
    setRevealed(new Set());
    setShareResults([]);
  };
  const addItem = () => {
    if (!payload || !isAdmin || !confirmDiscard()) return;
    discardUnsavedNew();
    const item: OpenItem = {
      localId: `new:${crypto.randomUUID()}`, serverId: null, ownerUserId: payload.userId,
      ownerName: user?.name ?? '', version: 0, updatedAt: new Date().toISOString(), shares: [], entry: emptyEntry(),
    };
    setItems((current) => [item, ...current]);
    setDraft(item);
    setDirty(true);
    setRevealed(new Set());
  };
  const updateDraft = (update: (item: OpenItem) => void) => {
    setDraft((current) => {
      if (!current) return current;
      const next = cloneItem(current);
      update(next);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    if (!draft || !payload?.keyProfile || !privateKey || draft.ownerUserId !== payload.userId || !isAdmin) return;
    if (!draft.entry.title.trim()) {
      setError(tr({ zh: '请填写标题。', en: 'Enter a title.' }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const encrypted = await encryptVaultEntry(draft.entry, [
        { userId: payload.userId, publicKey: payload.keyProfile.publicKey },
        ...draft.shares.map(({ userId, publicKey }) => ({ userId, publicKey })),
      ]);
      const response = await handleApi<{ id?: string; version: number; updatedAt: string }>(await fetch(
        apiUrl(draft.serverId ? `/v1/vault/items/${draft.serverId}` : '/v1/vault/items'),
        {
          method: draft.serverId ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ...encrypted, expectedVersion: draft.serverId ? draft.version : null }),
        },
      ));
      const saved: OpenItem = {
        ...cloneItem(draft),
        serverId: draft.serverId ?? response.id ?? null,
        localId: draft.serverId ?? response.id ?? draft.localId,
        version: response.version,
        updatedAt: response.updatedAt,
      };
      setItems((current) => current.map((item) => item.localId === draft.localId ? saved : item));
      setDraft(saved);
      setDirty(false);
    } catch (saveError) {
      setError((saveError as Error).message === 'item changed in another tab'
        ? tr({ zh: '这条内容已在其他页面修改，请刷新后重试。', en: 'This item changed in another tab. Refresh and try again.' })
        : tr({ zh: '保存失败，请稍后重试。', en: 'Could not save. Try again later.' }));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!draft || !payload || draft.ownerUserId !== payload.userId || !isAdmin
      || !window.confirm(tr({ zh: '永久删除这条加密内容？', en: 'Permanently delete this encrypted item?' }))) return;
    setBusy(true);
    setError(null);
    try {
      if (draft.serverId) await handleApi(await fetch(apiUrl(`/v1/vault/items/${draft.serverId}`), { method: 'DELETE', headers: authHeaders(false) }));
      const next = items.filter((item) => item.localId !== draft.localId);
      setItems(next);
      setDraft(next[0] ? cloneItem(next[0]) : null);
      setDirty(false);
    } catch {
      setError(tr({ zh: '删除失败，请稍后重试。', en: 'Could not delete the item. Try again later.' }));
    } finally { setBusy(false); }
  };

  const searchUsers = async (event: FormEvent) => {
    event.preventDefault();
    if (shareQuery.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const data = await handleApi<{ users: UserResult[] }>(await fetch(
        apiUrl(`/v1/vault/users?q=${encodeURIComponent(shareQuery.trim())}`),
        { headers: authHeaders(false) },
      ));
      setShareResults(data.users);
    } catch {
      setError(tr({ zh: '用户搜索失败，请稍后重试。', en: 'Could not search users. Try again later.' }));
    } finally { setBusy(false); }
  };

  if (!mounted) return <main className="vault-page" />;
  if (!user) return (
    <main className="vault-page vault-gate">
      <div className="vault-topbar"><BackHome /></div>
      <KeyRound aria-hidden="true" />
      <h1>{tr({ zh: '私密资料库', en: 'Private vault' })}</h1>
      <p>{tr({ zh: '登录后才能访问你的加密内容。', en: 'Sign in to access your encrypted content.' })}</p>
      <button type="button" className="vault-button is-primary" onClick={login}>{tr({ zh: '登录', en: 'Sign in' })}</button>
    </main>
  );
  if (!payload) return <main className="vault-page vault-loading"><Loader2 className="vault-spin" />{error ?? tr({ zh: '正在加载…', en: 'Loading…' })}</main>;
  if (!privateKey) {
    const isSetup = !payload.keyProfile;
    return (
      <main className="vault-page vault-gate">
        <div className="vault-topbar"><BackHome /></div>
        <KeyRound aria-hidden="true" />
        <h1>{tr({ zh: '私密资料库', en: 'Private vault' })}</h1>
        <p>{isSetup
          ? tr({ zh: '设置一个独立解锁口令。它不会上传，也无法找回；请务必自行安全备份。', en: 'Set a separate vault passphrase. It is never uploaded and cannot be recovered, so keep a safe backup.' })
          : tr({ zh: '输入资料库口令，在这台设备上解密。', en: 'Enter your vault passphrase to decrypt on this device.' })}</p>
        <form className="vault-unlock" onSubmit={isSetup ? setup : unlock}>
          <label htmlFor="vault-passphrase">{tr({ zh: '资料库口令', en: 'Vault passphrase' })}</label>
          <input id="vault-passphrase" type="password" value={passphrase} minLength={12} autoComplete={isSetup ? 'new-password' : 'current-password'} onChange={(event) => setPassphrase(event.target.value)} />
          {isSetup && <><label htmlFor="vault-confirm">{tr({ zh: '再次输入', en: 'Confirm passphrase' })}</label><input id="vault-confirm" type="password" value={confirmation} minLength={12} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} /></>}
          <button type="submit" className="vault-button is-primary" disabled={busy}>{busy && <Loader2 className="vault-spin" />}{tr(isSetup ? { zh: '创建并解锁', en: 'Create and unlock' } : { zh: '解锁', en: 'Unlock' })}</button>
        </form>
        {error && <p className="vault-error" role="alert">{error}</p>}
      </main>
    );
  }

  const editable = Boolean(draft && isAdmin && draft.ownerUserId === payload.userId);
  return (
    <main className="vault-page">
      <div className="vault-topbar"><BackHome /><button type="button" className="vault-button" onClick={() => {
        if (confirmDiscard()) window.location.reload();
      }}><Lock />{tr({ zh: '锁定', en: 'Lock' })}</button></div>
      <header className="vault-header">
        <div><h1>{tr({ zh: '私密资料库', en: 'Private vault' })}</h1><p>{tr({ zh: '内容只在浏览器中解密；共享对象必须是已注册且已启用资料库的账号。', en: 'Content is decrypted only in your browser. Recipients must be registered accounts with an initialized vault.' })}</p></div>
        {isAdmin && <button type="button" className="vault-button is-primary" onClick={addItem}><Plus />{tr({ zh: '新建', en: 'New item' })}</button>}
      </header>
      {failedCount > 0 && <p className="vault-error" role="alert">{tr({ zh: `${failedCount} 条内容无法解密。`, en: `${failedCount} item(s) could not be decrypted.` })}</p>}
      {error && <p className="vault-error" role="alert">{error}</p>}

      <div className="vault-workspace">
        <aside className="vault-sidebar">
          <SearchInput value={filter} onChange={setFilter} placeholder={tr({ zh: '搜索标题', en: 'Search titles' })} className="vault-filter" inputClassName="vault-input" />
          <div className="vault-list">{visibleItems.map((item) => (
            <button key={item.localId} type="button" className={`vault-list-item${draft?.localId === item.localId ? ' is-active' : ''}`} onClick={() => selectItem(item)}>
              <strong>{item.entry.title || tr({ zh: '未命名', en: 'Untitled' })}</strong>
              <span>{item.ownerUserId === payload.userId ? tr({ zh: '我的内容', en: 'Mine' }) : item.ownerName}</span>
            </button>
          ))}{!visibleItems.length && <p className="vault-muted">{tr({ zh: '没有内容。', en: 'No items.' })}</p>}</div>
        </aside>

        <section className="vault-editor">{!draft ? <p className="vault-muted">{tr({ zh: '选择一条内容，或新建一条。', en: 'Select an item or create one.' })}</p> : <>
          <div className="vault-editor-head">
            <input className="vault-title-input" value={draft.entry.title} readOnly={!editable} maxLength={200} placeholder={tr({ zh: '标题', en: 'Title' })} onChange={(event) => updateDraft((item) => { item.entry.title = event.target.value; })} />
            {editable && <div className="vault-actions"><button type="button" className="vault-button is-primary" disabled={busy || !dirty} onClick={() => void save()}><Save />{tr({ zh: '保存', en: 'Save' })}</button><button type="button" className="vault-button is-danger" disabled={busy} onClick={() => void remove()}><Trash2 />{tr({ zh: '删除', en: 'Delete' })}</button></div>}
          </div>

          <div className="vault-fields">{draft.entry.fields.map((field, index) => {
            const shown = !field.secret || revealed.has(field.id);
            return <div className="vault-field" key={field.id}>
              <input className="vault-label-input" value={field.label} readOnly={!editable} maxLength={100} placeholder={tr({ zh: '字段名', en: 'Field name' })} onChange={(event) => updateDraft((item) => { item.entry.fields[index].label = event.target.value; })} />
              <div className="vault-value-line">
                <input className="vault-value-input" type={shown ? 'text' : 'password'} value={field.value} readOnly={!editable} maxLength={100_000} placeholder={tr({ zh: '内容', en: 'Value' })} onChange={(event) => updateDraft((item) => { item.entry.fields[index].value = event.target.value; })} />
                {field.secret && <button type="button" className="vault-icon-button" aria-label={shown ? tr({ zh: '隐藏', en: 'Hide' }) : tr({ zh: '显示', en: 'Reveal' })} onClick={() => setRevealed((current) => { const next = new Set(current); if (shown) next.delete(field.id); else next.add(field.id); return next; })}>{shown ? <EyeOff /> : <Eye />}</button>}
                <button type="button" className="vault-icon-button" aria-label={tr({ zh: '复制', en: 'Copy' })} onClick={() => copy(field.value, field.id)}>{copiedKey === field.id ? <Check /> : <Copy />}</button>
                {editable && <button type="button" className="vault-icon-button is-danger" aria-label={tr({ zh: '删除字段', en: 'Delete field' })} onClick={() => updateDraft((item) => { item.entry.fields.splice(index, 1); })}><X /></button>}
              </div>
              {editable && <BoolToggle value={field.secret} onChange={(value) => updateDraft((item) => { item.entry.fields[index].secret = value; })} label={tr({ zh: '隐藏内容', en: 'Hide value' })} />}
            </div>;
          })}{editable && <button type="button" className="vault-button" onClick={() => updateDraft((item) => item.entry.fields.push({ id: crypto.randomUUID(), label: '', value: '', secret: false }))}><Plus />{tr({ zh: '添加字段', en: 'Add field' })}</button>}</div>

          <label className="vault-notes-label" htmlFor="vault-notes">{tr({ zh: '文本与备注', en: 'Text and notes' })}</label>
          <textarea id="vault-notes" className="vault-notes" value={draft.entry.notes} readOnly={!editable} maxLength={500_000} rows={10} onChange={(event) => updateDraft((item) => { item.entry.notes = event.target.value; })} />

          <section className="vault-sharing">
            <h2>{tr({ zh: '指定可查看账号', en: 'Designated viewers' })}</h2>
            <p>{tr({ zh: '与好友关系无关。撤销后旧版本不再提供，但无法抹除对方已经看过或复制的明文。', en: 'This is independent of friendship. Revocation removes future access, but cannot erase plaintext already viewed or copied.' })}</p>
            <div className="vault-share-list">{draft.shares.map((share) => <span className="vault-share" key={share.userId}>{share.name}<small>#{share.userId}</small>{editable && <button type="button" aria-label={tr({ zh: `移除 ${share.name}`, en: `Remove ${share.name}` })} onClick={() => updateDraft((item) => { item.shares = item.shares.filter((candidate) => candidate.userId !== share.userId); })}><X /></button>}</span>)}{!draft.shares.length && <span className="vault-muted">{tr({ zh: '仅自己', en: 'Only you' })}</span>}</div>
            {editable && <form className="vault-user-search" onSubmit={searchUsers}><SearchInput value={shareQuery} onChange={setShareQuery} placeholder={tr({ zh: '用户名、CubeRoot ID 或 WCA ID', en: 'Username, CubeRoot ID, or WCA ID' })} className="vault-share-search" inputClassName="vault-input" /><button type="submit" className="vault-button" disabled={busy || shareQuery.trim().length < 2}><Search />{tr({ zh: '搜索', en: 'Search' })}</button></form>}
            {editable && shareResults.length > 0 && <div className="vault-user-results">{shareResults.map((result) => {
              const added = draft.shares.some((share) => share.userId === result.userId);
              return <div key={result.userId}><span><strong>{result.name}</strong><small>#{result.userId}{result.wcaId ? `  ${result.wcaId}` : ''}</small></span><button type="button" className="vault-button" disabled={!result.publicKey || added} onClick={() => { if (result.publicKey) updateDraft((item) => { item.shares.push({ userId: result.userId, name: result.name, publicKey: result.publicKey as JsonWebKey }); }); }}><UserPlus />{added ? tr({ zh: '已添加', en: 'Added' }) : result.publicKey ? tr({ zh: '添加', en: 'Add' }) : tr({ zh: '对方尚未启用', en: 'Not initialized' })}</button></div>;
            })}</div>}
          </section>
        </>}</section>
      </div>
    </main>
  );
}
