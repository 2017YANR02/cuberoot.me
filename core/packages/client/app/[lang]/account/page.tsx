'use client';

/**
 * /account —— 「我的」页,全站唯一。默认只展示当前登录者的数据；管理员可通过受保护的
 * user 视图编辑 CubeRoot 用户资料。公开资料仍各归各页(选手档案 /wca/persons/:id、
 * 选手复盘 /recon/person/:id),普通用户这里只放属于我的:账号凭据、学习进度、关注的比赛、登出。
 * 也没有登录弹层:未登录就直接渲染登录表单,登录后按 next 回到来处。一次性绑定令牌只从
 * fragment 续接,不能进入 query、服务端日志或 Referer。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { installedPetAvailable } from '@/lib/installed-content';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsInteger, parseAsStringEnum } from 'nuqs';
import { Bell, BookOpen, Building2, ChevronLeft, ChevronRight, Crown, LockKeyhole, LogOut, Settings, Rewind, IdCard, GraduationCap, Inbox, Lightbulb, Loader2, Pencil, Upload, X, UserRound, Users, UserCog } from 'lucide-react';
import AppLink from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import { ClearButton } from '@/components/ClearButton';
import FollowedComps from '@/components/FollowedComps';
import AlgValidationAlert from '@/components/AlgValidationAlert';
import AdminSubmissionsPanel from '@/components/AdminSubmissionsPanel';
import PageNoticesAdmin from '@/components/PageNoticesAdmin';
import { UserIdLabel } from '@/components/UserIdLabel';
import { Flag } from '@/components/Flag';
import { CountryInput } from '@/components/CountryInput/CountryInput';
import { CompactSelect } from '@/components/CompactSelect';
import { DateInput } from '@/components/DateInput';
import { AccountPanel, LoginForm, IdentityChoicePanel, WcaLinkPrompt, DeleteAccountPanel, type SignedIn } from '@/components/AuthPanel';
import { getIdentityChoice, useIdentityChoice } from '@/lib/identity-choice';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import {
  ACCOUNT_BIRTH_DATE_MIN,
  DISPLAY_NAME_MAX_LENGTH,
  isValidDisplayName,
  isForumReplyProfileComplete,
  normalizeDisplayName,
  type AccountBasicProfile,
  type AccountGender,
} from '@cuberoot/shared/account';
import { ACCOUNT_AVATAR_PRESETS, getAccountAvatarPreset, DEFAULT_CLAWD_AVATAR_PRESET } from '@cuberoot/shared/account-avatar';
import {
  isMobileAuthProvider,
  type MobileAuthProvider,
} from '@cuberoot/shared/auth/web-session';
import {
  fetchAdminUser,
  fetchAccountBasicProfile,
  updateAdminDisplayName,
  updateAccountBasicProfile,
  updateAvatar,
  updateDisplayName,
  type AvatarChoice,
  type SessionUser,
} from '@/lib/account-api';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { fetchPersonCard } from '@/lib/wca-api';
import { clawdAvatarUrl } from '@/lib/account-avatar';
import { getDeskPetCatalog } from '@/lib/deskpet-api';
import { resolveDeskPets, type DeskPetEntry } from '@cuberoot/shared/deskpet';
import { THEMES, type ThemeId } from '@/lib/deskpet-themes';
import { displayCuberName } from '@/lib/cuber-name-display';
import { loadFlagData, personFlagIso2 } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { localizeCity } from '@/lib/city-localize';
import { prepareImageUpload, uploadImageBlob } from '@/lib/image-upload';
import { toLocalIsoDate } from '@/lib/iso-date';
import { applySession, hasAdminAccess, useAuthStore, safeNext, takeWcaLinkPrompt } from '@/lib/auth-store';
import { isMiniProgramCommerceRestricted, notifyMiniProgramLogout } from '@/lib/miniprogram-bridge';
import { tr, useLang } from '@/i18n/tr';
import PetAccountCard from '@/components/PetAccountCard';
import AccountCardGrid from './AccountCardGrid';
import './account.css';

function AccountName({ name, wcaId }: { name: string; wcaId?: string | null }) {
  const t = useT();
  const isZh = useLang() !== 'en';
  const [iso2, setIso2] = useState(() => wcaId ? personFlagIso2(wcaId) : '');

  useEffect(() => {
    setIso2(wcaId ? personFlagIso2(wcaId) : '');
    if (!wcaId) return;
    let cancelled = false;
    void loadFlagData().then(() => {
      if (!cancelled) setIso2(personFlagIso2(wcaId));
    });
    return () => { cancelled = true; };
  }, [wcaId]);

  const displayName = name
    ? (wcaId ? displayCuberName(name, isZh) : name)
    : t('未命名', 'Unnamed');

  return (
    <h1 className="account-name">
      {iso2 && <Flag iso2={iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}
      <span>{displayName}</span>
    </h1>
  );
}

function AvatarEditor() {
  const t = useT();
  const user = useAuthStore(s => s.user);
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const preset = getAccountAvatarPreset(user.avatarPreset ?? DEFAULT_CLAWD_AVATAR_PRESET);
  const isClawd = (user.avatarSource === 'clawd' || !user.avatar) && preset?.petId === 'clawd';
  return <div className="account-avatar-editor">
    <button type="button" className={`account-avatar-preview account-avatar-edit-button${isClawd ? ' is-clawd' : ''}`}
      aria-label={t('更换头像', 'Change avatar')} title={t('更换头像', 'Change avatar')} onClick={() => setOpen(true)}>
      <img src={user.avatar} alt="" />
    </button>
    <button type="button" className="account-avatar-pencil" aria-label={t('编辑头像', 'Edit avatar')}
      title={t('编辑头像', 'Edit avatar')} onClick={() => setOpen(true)}>
      <Pencil size={13} aria-hidden="true" />
    </button>
    {open && <AvatarChooser onClose={() => setOpen(false)} />}
  </div>;
}

function AvatarChooser({ onClose }: { onClose: () => void }) {
  const t = useT();
  const user = useAuthStore(s => s.user);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRequest = useRef(0);
  const [source, setSource] = useState<'wca' | 'upload' | 'pet'>(() => user?.avatarSource === 'clawd' ? 'pet' : user?.wcaId && user.avatarSource === 'auto' ? 'wca' : user?.avatarSource === 'upload' ? 'upload' : 'pet');
  const [preset, setPreset] = useState(user?.avatarPreset ?? DEFAULT_CLAWD_AVATAR_PRESET);
  const [avatarPet, setAvatarPet] = useState(getAccountAvatarPreset(preset)?.petId ?? 'clawd');
  const [avatarPets, setAvatarPets] = useState<DeskPetEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareImageUpload>> | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [wcaAvatar, setWcaAvatar] = useState(user?.avatarSource === 'auto' && user.wcaId ? user.avatar : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropProps = useModalDismiss(onClose, saving);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  useEffect(() => {
    let live = true;
    setCatalogLoading(true);
    setCatalogError(false);
    getDeskPetCatalog().then(catalog => {
      if (!live) return;
      const pets = resolveDeskPets([...new Set(ACCOUNT_AVATAR_PRESETS.map(p => p.petId))], catalog.entries)
        .filter(p => !p.locked && !p.removed && installedPetAvailable(p.id));
      setAvatarPets(pets);
      setAvatarPet(current => pets.some(p => p.id === current) ? current : pets[0]?.id ?? '');
    }).catch(() => { if (live) setCatalogError(true); })
      .finally(() => { if (live) setCatalogLoading(false); });
    return () => { live = false; };
  }, [catalogRetry]);
  useEffect(() => {
    let live = true;
    if (user?.wcaId && !wcaAvatar) void fetchPersonCard(user.wcaId).then(card => {
      if (live && card?.avatar) setWcaAvatar(card.avatar);
    });
    return () => { live = false; };
  }, [user?.wcaId, wcaAvatar]);
  useEffect(() => {
    if (source !== 'pet' || catalogLoading) return;
    dialogRef.current?.querySelector('[data-avatar-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [source, avatarPet, catalogLoading]);

  const prepareUpload = async (file: File | undefined) => {
    if (!file) return;
    const request = ++fileRequest.current;
    setPreparing(true);
    setPrepared(null);
    setError(null);
    try {
      const next = await prepareImageUpload(file, 512);
      if (request === fileRequest.current) setPrepared(next);
    } catch {
      if (request === fileRequest.current) setError(t('图片读取失败，请选择 PNG、JPEG 或 WebP 图片。', 'Could not read the image. Choose a PNG, JPEG, or WebP image.'));
    } finally {
      if (request === fileRequest.current) setPreparing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const selectedPet = getAccountAvatarPreset(preset);
  const petAvailable = avatarPets.some(p => p.id === selectedPet?.petId);
  const preview = source === 'pet' ? clawdAvatarUrl(preset)
    : source === 'wca' ? wcaAvatar
      : prepared?.previewUrl ?? (user?.avatarSource === 'upload' ? user.avatar : '');
  const canSave = source === 'pet' ? petAvailable : source === 'wca' ? Boolean(wcaAvatar) : Boolean(prepared);
  const save = async () => {
    if (!canSave || saving || preparing) return;
    setSaving(true);
    setError(null);
    try {
      let choice: AvatarChoice;
      if (source === 'upload' && prepared) {
        const image = await uploadImageBlob(prepared.dataB64, prepared.mime);
        choice = { kind: 'upload', imageId: image.id };
      } else if (source === 'wca') choice = { kind: 'wca' };
      else choice = { kind: 'clawd', preset };
      const session = await updateAvatar(choice);
      if (!(await applySession(session.token, session.user))) throw new Error('session persistence failed');
      onClose();
    } catch {
      setError(t('头像保存失败，请稍后重试。', 'Could not save the avatar. Try again later.'));
    } finally { setSaving(false); }
  };
  if (!user) return null;
  return <dialog ref={dialogRef} className="account-avatar-dialog" aria-labelledby="account-avatar-title"
    {...backdropProps} onCancel={event => event.preventDefault()}>
    <section className="account-avatar-modal" data-site-surface="popover">
      <header className="account-avatar-modal-header">
        <h2 id="account-avatar-title">{t('更换头像', 'Change avatar')}</h2>
        <button type="button" className="auth-link" aria-label={t('关闭', 'Close')} disabled={saving} onClick={onClose}><X size={18} /></button>
      </header>
      <div className="account-avatar-sources" role="group" aria-label={t('头像来源', 'Avatar source')}>
        {(['wca', 'upload', 'pet'] as const).filter(kind => kind !== 'wca' || user.wcaId).map(kind =>
          <button key={kind} type="button" className="auth-link" aria-pressed={source === kind} disabled={saving}
            onClick={() => { setSource(kind); setError(null); }}>
            {kind === 'wca' ? t('WCA 头像', 'WCA avatar') : kind === 'upload' ? t('上传图片', 'Upload image') : t('宠物头像', 'Pet avatar')}
          </button>)}
      </div>
      <div className="account-avatar-modal-preview">
        <div className={`account-avatar-preview${source === 'pet' && selectedPet?.petId === 'clawd' ? ' is-clawd' : ''}`}>
          {preview && <img src={preview} alt={t('头像预览', 'Avatar preview')} />}
        </div>
        <span className="auth-hint">{t('预览', 'Preview')}</span>
      </div>
      {source === 'wca' && !wcaAvatar && <p className="auth-hint">{t('WCA 头像暂时无法预览。', 'WCA avatar preview is currently unavailable.')}</p>}
      {source === 'upload' && <div className="account-avatar-upload">
        <button type="button" className="auth-link" disabled={saving || preparing} onClick={() => fileRef.current?.click()}><Upload size={14} /> {t('选择图片', 'Choose image')}</button>
        <input ref={fileRef} className="account-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void prepareUpload(event.target.files?.[0])} />
        {preparing && <Loader2 size={14} className="auth-spin" aria-label={t('正在读取图片', 'Reading image')} />}
      </div>}
      {source === 'pet' && <>
        {catalogLoading ? <p className="auth-hint">{t('正在加载…', 'Loading…')}</p> : catalogError
          ? <button type="button" className="auth-link" onClick={() => setCatalogRetry(n => n + 1)}>{t('加载失败，点击重试', 'Could not load. Retry')}</button>
          : avatarPets.length === 0 ? <p className="auth-hint">{t('暂无可用形象', 'No avatars available')}</p>
          : <select className="auth-input account-avatar-pet-select" aria-label={t('头像形象', 'Avatar character')}
              value={avatarPet} disabled={saving} onChange={event => setAvatarPet(event.target.value)}>
              {avatarPets.map(p => <option key={p.id} value={p.id}>{t((p.label ?? THEMES[p.id as ThemeId]?.label)?.zh ?? p.id, (p.label ?? THEMES[p.id as ThemeId]?.label)?.en ?? p.id)}</option>)}
            </select>}
        <div className="account-clawd-grid">
          {ACCOUNT_AVATAR_PRESETS.filter(p => p.petId === avatarPet && avatarPets.some(pet => pet.id === p.petId)).map(p =>
            <button key={p.id} type="button" className={`account-clawd-choice${preset === p.id ? ' is-selected' : ''}`}
              aria-label={t(p.zh, p.en)} aria-pressed={preset === p.id} data-avatar-selected={preset === p.id}
              disabled={saving} onClick={() => setPreset(p.id)}>
              <span className="account-clawd-image"><img src={clawdAvatarUrl(p.id)} alt="" loading="lazy" /></span>
              <span>{t(p.zh, p.en)}</span>
            </button>)}
        </div>
      </>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <footer className="account-avatar-modal-footer">
        <button type="button" className="auth-link" disabled={saving} onClick={onClose}>{t('取消', 'Cancel')}</button>
        <button type="button" className="auth-primary" disabled={saving || preparing || !canSave} onClick={() => void save()}>
          {saving && <Loader2 size={14} className="auth-spin" />}{t('使用此头像', 'Use this avatar')}
        </button>
      </footer>
    </section>
  </dialog>;
}

function DisplayNameField({
  profile,
  onSave,
}: {
  profile: Pick<SessionUser, 'name' | 'wcaId'>;
  onSave: (name: string) => Promise<void>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wcaLocked = Boolean(profile.wcaId);
  const isZh = useLang() !== 'en';

  useEffect(() => {
    if (!editing) setName(profile.name);
  }, [editing, profile.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setName(profile.name);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    if (wcaLocked) {
      setEditing(false);
      return;
    }
    const normalized = normalizeDisplayName(name);
    setName(normalized);
    setError(null);
    if (!isValidDisplayName(normalized)) {
      setError(t(`请输入 1–${DISPLAY_NAME_MAX_LENGTH} 个字符的用户名，不能包含换行或控制字符。`, `Enter a username of 1–${DISPLAY_NAME_MAX_LENGTH} characters without line breaks or control characters.`));
      return;
    }
    if (normalized === profile.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(normalized);
      setEditing(false);
    } catch {
      setError(t('用户名保存失败，请稍后重试。', 'Could not save the username. Try again later.'));
    } finally {
      setSaving(false);
    }
  };

  return wcaLocked ? null : (
    <>
      <div className="auth-idrow">
        <span className="auth-idicon"><UserRound size={16} /></span>
        <span className="auth-idprov">{wcaLocked ? t('姓名', 'Name') : t('用户名', 'Username')}</span>
        <span className="auth-iduid">{(wcaLocked ? displayCuberName(profile.name, isZh) : profile.name) || t('未设置', 'Not set')}</span>
        {!editing && !wcaLocked && (
          <div className="auth-idactions">
            <button type="button" className="auth-link" onClick={() => { setError(null); setEditing(true); }}>
              {profile.name ? t('修改', 'Edit') : t('设置', 'Set')}
            </button>
          </div>
        )}
      </div>
      {wcaLocked && (
        <p className="auth-hint account-name-lock-hint">
          {t('取自 WCA', 'From WCA')}
        </p>
      )}
      {editing && !wcaLocked && (
        <form className="account-name-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <label className="auth-label" htmlFor="account-display-name">{t('用户名', 'Username')}</label>
          <div className="account-name-field">
            <input
              ref={inputRef}
              id="account-display-name"
              className="auth-input"
              value={name}
              disabled={saving}
              autoComplete="nickname"
              aria-describedby="account-display-name-hint"
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
            />
            {name && !saving && <ClearButton onClick={() => setName('')} preserveFocus />}
          </div>
          <p id="account-display-name-hint" className="auth-hint">
            {t(`最多 ${DISPLAY_NAME_MAX_LENGTH} 个字符，仅用于站内显示，不能用来登录。`, `Up to ${DISPLAY_NAME_MAX_LENGTH} characters. This is only for display and cannot be used to sign in.`)}
          </p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="account-name-actions">
            <button type="submit" className="auth-primary account-name-save" disabled={saving}>
              {saving && <Loader2 size={14} className="auth-spin" />}
              {t('保存', 'Save')}
            </button>
            <button type="button" className="auth-textbtn" disabled={saving} onClick={cancel}>
              {t('取消', 'Cancel')}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function DisplayNameEditor() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const save = async (name: string) => {
    const session = await updateDisplayName(name);
    if (!(await applySession(session.token, session.user))) throw new Error('session persistence failed');
  };
  return (
    <div className="account-profile-editor">
      <h2 className="account-creds-title">{t('个人资料', 'Profile')}</h2>
      <DisplayNameField
        profile={{ name: user.name, wcaId: user.wcaId || null }}
        onSave={save}
      />
      <BasicProfileEditor />
    </div>
  );
}

type EditableBasicProfile = Pick<AccountBasicProfile, 'fullName' | 'birthDate' | 'gender' | 'countryIso2' | 'regionCode' | 'cityName'>;
type AccountRegion = { code: string; name: string; nameZh?: string; cities: string[]; cityNamesZh?: Record<string, string>; legacyCityNamesZh?: Record<string, string> };

function BasicProfileEditor() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const isZh = useLang() !== 'en';
  const [profile, setProfile] = useState<AccountBasicProfile | null>(null);
  const [draft, setDraft] = useState<EditableBasicProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<AccountRegion[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState(false);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [locationMenuRegion, setLocationMenuRegion] = useState<string | null>(null);
  const today = toLocalIsoDate();

  useEffect(() => {
    let cancelled = false;
    fetchAccountBasicProfile()
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setDraft({
          fullName: next.fullName,
          birthDate: next.birthDate,
          gender: next.gender,
          countryIso2: next.countryIso2,
          regionCode: next.regionCode,
          cityName: next.cityName,
        });
      })
      .catch(() => {
        if (!cancelled) setError(t('基本资料加载失败，请稍后重试。', 'Could not load your basic profile. Try again later.'));
      });
    return () => { cancelled = true; };
  }, [t]);

  useEffect(() => {
    const countryIso2 = draft?.countryIso2;
    setRegions([]);
    setLocationsError(false);
    if (!countryIso2) {
      setLocationsLoading(false);
      return;
    }
    let cancelled = false;
    setLocationsLoading(true);
    fetch(`/account-locations/${countryIso2}.json?v=6`, { cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = await response.json() as AccountRegion[];
        if (!cancelled) setRegions(next);
      })
      .catch(() => { if (!cancelled) setLocationsError(true); })
      .finally(() => { if (!cancelled) setLocationsLoading(false); });
    return () => { cancelled = true; };
  }, [draft?.countryIso2]);

  if (!profile || !draft) {
    return error
      ? <p className="auth-error account-basic-profile-status" role="alert">{error}</p>
      : <p className="auth-hint account-basic-profile-status"><Loader2 size={14} className="auth-spin" />{t('正在加载基本资料…', 'Loading basic profile…')}</p>;
  }

  const countryLocked = profile.countrySource === 'wca';
  const nameLocked = Boolean(user?.wcaId);
  const fullNameValue = nameLocked ? (user?.name ?? '') : (draft.fullName ?? '');
  const dirty = (normalizeDisplayName(fullNameValue) || null) !== profile.fullName
    || draft.birthDate !== profile.birthDate
    || draft.gender !== profile.gender
    || (!countryLocked && draft.countryIso2 !== profile.countryIso2)
    || draft.regionCode !== profile.regionCode
    || draft.cityName !== profile.cityName;
  const updateDraft = (patch: Partial<EditableBasicProfile>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setSaved(false);
    setError(null);
  };
  const save = async () => {
    const fullName = normalizeDisplayName(fullNameValue) || null;
    if (fullName !== null && !isValidDisplayName(fullName)) {
      setError(t(`请输入不超过 ${DISPLAY_NAME_MAX_LENGTH} 个字符的姓名，不能包含换行或控制字符。`, `Enter a name of up to ${DISPLAY_NAME_MAX_LENGTH} characters without line breaks or control characters.`));
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await updateAccountBasicProfile({
        fullName,
        birthDate: draft.birthDate,
        gender: draft.gender,
        countryIso2: countryLocked ? profile.countryIso2 : draft.countryIso2,
        regionCode: draft.regionCode,
        cityName: draft.cityName,
      });
      setProfile(result.profile);
      setDraft({
        fullName: result.profile.fullName,
        birthDate: result.profile.birthDate,
        gender: result.profile.gender,
        countryIso2: result.profile.countryIso2,
        regionCode: result.profile.regionCode,
        cityName: result.profile.cityName,
      });
      setSaved(true);
    } catch {
      setError(t('基本资料保存失败，请检查内容后重试。', 'Could not save your basic profile. Check the fields and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const genderOptions: Array<{ value: AccountGender; label: string }> = [
    { value: 'male', label: t('男', 'Male') },
    { value: 'female', label: t('女', 'Female') },
  ];
  const selectedRegion = regions.find((region) => region.code === draft.regionCode);
  const regionLabel = (region: AccountRegion) => t(region.nameZh ?? localizeCity(region.name, true, draft.countryIso2), region.name);
  const menuRegion = regions.find((region) => region.code === locationMenuRegion);
  const cityLabel = (city: string) => {
    const label = t(selectedRegion?.cityNamesZh?.[city] ?? selectedRegion?.legacyCityNamesZh?.[city] ?? localizeCity(city, true, draft.countryIso2), localizeCity(city, false, draft.countryIso2));
    return !locationsLoading && !locationsError && selectedRegion && !selectedRegion.cities.includes(city)
      ? t(`${label}（已保存的旧资料）`, `${label} (previously saved)`)
      : label;
  };

  return (
    <form className="account-basic-profile" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {(profile.forumBanned || !profile.forumProfileExempt) && <p className="auth-hint" role="status">
        {profile.forumBanned
          ? t('你的账号已被禁止在论坛发帖和评论。', 'Your account is banned from posting and commenting in the forum.')
          : isForumReplyProfileComplete(profile, today)
          ? t('已保存的资料完整，可以在论坛评论。', 'Your saved profile is complete. You can comment in the forum.')
          : t('论坛评论前请填写并保存姓名、出生日期、性别、国家、省份和城市；没有可选省市的地区无需填写对应项。', 'Before commenting, save your name, birth date, gender, country, state and city. Location fields without available options are exempt.')}
      </p>}
      {!nameLocked && <div className="account-basic-profile-field">
        <label className="auth-label" htmlFor="account-full-name">{t('姓名', 'Name')}</label>
        <div className="account-name-field">
          <input
            id="account-full-name"
            className="auth-input"
            value={nameLocked ? displayCuberName(fullNameValue, isZh) : fullNameValue}
            disabled={saving || nameLocked}
            autoComplete="name"
            aria-describedby="account-full-name-hint"
            onChange={(event) => updateDraft({ fullName: event.target.value || null })}
          />
          {draft.fullName && !saving && !nameLocked && <ClearButton onClick={() => updateDraft({ fullName: null })} preserveFocus />}
        </div>
        <p id="account-full-name-hint" className="auth-hint">
          {nameLocked
            ? t('取自 WCA', 'From WCA')
            : t(`最多 ${DISPLAY_NAME_MAX_LENGTH} 个字符，不会替代公开显示的用户名。`, `Up to ${DISPLAY_NAME_MAX_LENGTH} characters. This does not replace your public username.`)}
        </p>
      </div>}
      <div className="account-profile-demographics">
      <div className="account-basic-profile-field account-birth-date-field">
        <label className="auth-label" htmlFor="account-birth-date">{t('出生日期', 'Birth date')}</label>
        <DateInput
          id="account-birth-date"
          value={draft.birthDate ?? ''}
          min={ACCOUNT_BIRTH_DATE_MIN}
          max={today}
          placeholder={t('未填写', 'Not set')}
          clearAriaLabel={t('清除出生日期', 'Clear birth date')}
          disabled={saving}
          onChange={(value) => updateDraft({ birthDate: value || null })}
        />
      </div>
      <div className="account-basic-profile-field account-gender-field">
        <label className="auth-label" htmlFor="account-gender">{t('性别', 'Gender')}</label>
        <select
          id="account-gender"
          className="auth-input account-basic-profile-select"
          value={draft.gender ?? ''}
          disabled={saving}
          onChange={(event) => updateDraft({ gender: (event.target.value || null) as AccountGender | null })}
        >
          <option value="" hidden>{t('未填写', 'Not set')}</option>
          {genderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {profile.genderSource === 'wca' && draft.gender === profile.gender && <p className="auth-hint">{t('取自 WCA', 'From WCA')}</p>}
      </div>
      </div>
      <div className="account-basic-profile-field account-location-field">
        <label
          className="auth-label"
          id="account-country-label"
          htmlFor={countryLocked ? undefined : 'account-country'}
        >
          {t('国家 / 地区', 'Country / location')}
        </label>
        <div className="account-location-controls">
        <div className="account-location-country">
        {countryLocked ? (
          <div className="account-basic-profile-country" aria-labelledby="account-country-label">
            {profile.countryIso2 ? (
              <>
                <Flag iso2={profile.countryIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />
                <span>{countryName(profile.countryIso2, isZh)}</span>
              </>
            ) : <span>{t('WCA 暂未返回国家', 'Country is not yet available from WCA')}</span>}
          </div>
        ) : (
          <CountryInput
            id="account-country"
            ariaLabel={t('搜索并选择国家', 'Search and choose country')}
            value={draft.countryIso2 ?? ''}
            placeholder={t('搜索国家或地区', 'Search country or region')}
            onChange={(iso2) => updateDraft({
              countryIso2: iso2 ? iso2.toUpperCase() : null,
              regionCode: null,
              cityName: null,
            })}
          />
        )}
        {countryLocked && (
          <p className="auth-hint account-basic-profile-lock">
            {t('取自 WCA', 'From WCA')}
          </p>
        )}
      </div>
      {draft.countryIso2 && (
        <div className="account-location-region">
          <CompactSelect
            id="account-location"
            ariaLabel={t('地区', 'Location')}
            label={draft.regionCode
              ? [selectedRegion ? regionLabel(selectedRegion) : draft.regionCode, draft.cityName ? cityLabel(draft.cityName) : null].filter(Boolean).join(' / ')
              : locationsLoading ? t('正在加载…', 'Loading…')
                : locationsError ? t('地区加载失败', 'Could not load locations')
                  : regions.length === 0 ? t('暂无地区', 'No locations')
                    : t('请选择地区', 'Select a location')}
            disabled={saving || locationsLoading || locationsError || regions.length === 0}
            items={[]}
            onChange={() => {}}
            open={locationMenuOpen}
            onOpenChange={(open) => {
              setLocationMenuOpen(open);
              if (open) setLocationMenuRegion(draft.regionCode);
            }}
            popupClassName="account-location-popup"
            panelContent={
              <div className="account-location-menu">
                <div className="account-location-level" role="group" aria-label={t('省份', 'State or province')}>
                  {regions.map((region) => (
                    <button type="button" key={region.code}
                      className={'compact-select-option account-location-option' + (locationMenuRegion === region.code ? ' active' : '')}
                      aria-expanded={region.cities.length ? locationMenuRegion === region.code : undefined}
                      onClick={() => {
                        if (region.cities.length) setLocationMenuRegion(region.code);
                        else {
                          updateDraft({ regionCode: region.code, cityName: null });
                          setLocationMenuOpen(false);
                        }
                      }}>
                      <span>{regionLabel(region)}</span>
                      {region.cities.length > 0 && <ChevronRight size={14} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                {menuRegion && menuRegion.cities.length > 0 && (
                  <div className="account-location-level" role="group" aria-label={t('城市／地区', 'City / district')} key={menuRegion.code}>
                    {menuRegion.cities.map((city) => (
                      <button type="button" key={city}
                        className={'compact-select-option account-location-option' + (draft.regionCode === menuRegion.code && draft.cityName === city ? ' active' : '')}
                        aria-pressed={draft.regionCode === menuRegion.code && draft.cityName === city}
                        onClick={() => {
                          updateDraft({ regionCode: menuRegion.code, cityName: city });
                          setLocationMenuOpen(false);
                        }}>
                        {t(menuRegion.cityNamesZh?.[city] ?? localizeCity(city, true, draft.countryIso2), localizeCity(city, false, draft.countryIso2))}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          />
        </div>
      )}
        </div>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {saved && <p className="auth-hint" role="status">{t('基本资料已保存。', 'Basic profile saved.')}</p>}
      <button type="submit" className="auth-primary account-basic-profile-save" disabled={saving || !dirty}>
        {saving && <Loader2 size={14} className="auth-spin" />}
        {t('保存基本资料', 'Save basic profile')}
      </button>
    </form>
  );
}

function AdminUserEditor({ userId }: { userId: number }) {
  const t = useT();
  const [profile, setProfile] = useState<SessionUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null);
    setError(null);
    let cancelled = false;
    fetchAdminUser(userId)
      .then((nextProfile) => { if (!cancelled) setProfile(nextProfile); })
      .catch(() => { if (!cancelled) setError(t('用户资料加载失败，请稍后重试。', 'Could not load the user profile. Try again later.')); });
    return () => { cancelled = true; };
  }, [t, userId]);

  if (error) return <p className="auth-error" role="alert">{error}</p>;
  if (!profile) return <p className="auth-hint"><Loader2 size={14} className="auth-spin" />{t('加载中…', 'Loading…')}</p>;

  return (
    <>
      <div className="account-id-row">
        <AccountName name={profile.name} wcaId={profile.wcaId} />
        <UserIdLabel userId={profile.uid} full />
      </div>
      <section className="account-creds">
        <div className="account-profile-editor">
          <h2 className="account-creds-title">{t('个人资料', 'Profile')}</h2>
          <DisplayNameField
            profile={profile}
            onSave={async (name) => setProfile(await updateAdminDisplayName(userId, name))}
          />
        </div>
      </section>
    </>
  );
}

export default function AccountPage() {
  const t = useT();
  const pendingIdentity = useIdentityChoice();
  const router = useRouter();
  const uiLang: 'zh' | 'en' = useLang() === 'en' ? 'en' : 'zh';

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // 齿轮切「登录方式」视图,再往里一层是「注销账号」。切换全靠真 <a>(中键可新开),页面只
  // 跟着 URL 走;push 进历史,浏览器后退能层层退回。setter 只用来在登出时清掉参数。
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<'main' | 'signin' | 'delete' | 'submissions' | 'user'>(['main', 'signin', 'delete', 'submissions', 'user']).withDefault('main').withOptions({ history: 'push' }),
  );
  const [managedUserId] = useQueryState('user', parseAsInteger);
  const [linkProvider] = useQueryState('link_provider', parseAsStringEnum(['apple']));
  const [expectedLinkUid] = useQueryState('expected_uid', parseAsInteger);
  const [miniProgramAction] = useQueryState('mini_program', parseAsStringEnum(['login']));

  // 'wait' = 还没判定(SSR / 正在跳走)—— auth-store 从 localStorage 同步初始化,服务端恒为
  // null,所以判定只能在挂载后做,渲染前固定空壳避免 hydration 错配。
  // 'onboard' = 刚注册完的那一步「你有 WCA ID 吗」,挡在回跳 next 之前。
  const [mode, setMode] = useState<'wait' | 'login' | 'onboard' | 'me'>('wait');
  const [mobileAuth, setMobileAuth] = useState(false);
  const [mobileAuthProvider, setMobileAuthProvider] = useState<MobileAuthProvider | null>(null);
  const [commerceRestricted, setCommerceRestricted] = useState(true);
  useEffect(() => {
    let cancel = false;
    void isMiniProgramCommerceRestricted().then((restricted) => {
      if (!cancel) setCommerceRestricted(restricted);
    });
    return () => { cancel = true; };
  }, []);
  const next = useRef<string | null>(null);

  // The native Apps reuse this page instead of maintaining a second account UI.
  // A provider-tagged system-Browser handoff may expose the canonical SSO buttons;
  // preserve that provider and the PKCE continuation across account-local hops.
  const accountHref = (nextView?: 'signin' | 'delete' | 'submissions') => {
    const params = new URLSearchParams();
    if (nextView) params.set('view', nextView);
    if (linkProvider === 'apple') {
      params.set('link_provider', 'apple');
      if (expectedLinkUid !== null) params.set('expected_uid', String(expectedLinkUid));
    }
    if (mobileAuth) {
      params.set('auth', 'mobile');
      if (mobileAuthProvider) params.set('provider', mobileAuthProvider);
      if (next.current) params.set('next', next.current);
    }
    const search = params.toString();
    return `/account${search ? `?${search}` : ''}`;
  };

  const handleLogout = useCallback(() => {
    logout();
    void setView(linkProvider === 'apple' ? 'signin' : null);
    setMode('login');
    void notifyMiniProgramLogout();
  }, [logout, setView, linkProvider]);

  useDocumentTitle(
    mode !== 'me' ? '登录' : view === 'delete' ? '注销账号' : view === 'submissions' ? '公式投稿' : view === 'user' ? '编辑用户' : '我的',
    mode !== 'me' ? 'Sign in' : view === 'delete' ? 'Delete account' : view === 'submissions' ? 'Algorithm submissions' : view === 'user' ? 'Edit user' : 'My account',
  );

  /** 拿到会话后该去哪:有回跳就回去,否则留在本页。 */
  const leave = useCallback(() => {
    if (next.current) { router.replace(next.current); return; }
    setMode('me');
  }, [router]);

  /**
   * 登录/注册完成。**只有新注册、且账号还没绑 WCA** 才多问一步 —— 老用户每次登录都被问
   * 一遍会很烦,用 WCA 注册的人本来就有。问不问都不拦路:引导那步随时可跳过。
   */
  const settle = useCallback((info?: SignedIn) => {
    if (mobileAuth) { leave(); return; }
    if (info?.isNew && !info.hasWca) { setMode('onboard'); return; }
    leave();
  }, [leave, mobileAuth]);

  // 只在挂载时判一次。**不能**改成盯着 user 变化自动跳:忘记密码流在验证码通过时就已经登录,
  // 但人还得留在表单里设新密码 —— 一盯 user 就会把那一步抽走。何时算完成由表单的 onDone 说了算。
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const isMobileAuth = search.get('auth') === 'mobile';
    const provider = search.get('provider');
    setMobileAuth(isMobileAuth);
    setMobileAuthProvider(isMobileAuth && isMobileAuthProvider(provider) ? provider : null);
    const fragmentNext = new URLSearchParams(window.location.hash.slice(1)).get('next');
    next.current = safeNext(fragmentNext) ?? safeNext(search.get('next'));
    const u = useAuthStore.getState().user;
    if (!u) { setMode('login'); return; }
    // The system Browser can already hold a canonical website session (for example after
    // returning from WCA/social OAuth). Continue to /auth/mobile immediately so that page
    // can mint the PKCE-bound one-time ticket and deep-link back to the native App.
    if (isMobileAuth && next.current && !getIdentityChoice()) {
      router.replace(next.current);
      return;
    }
    // 三方(微信/QQ/支付宝)注册那条路:授权是整页跳走再回来的,回来时人已不在 LoginForm 里,
    // 拿不到 onDone —— 靠回调页留下的标记把同一步引导接上。
    setMode(takeWcaLinkPrompt() && !u.wcaId ? 'onboard' : 'me');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === 'wait') return <div className="account-page" />;

  // 我的公开页入口 —— 只有绑了 WCA 的账号才有;学习进度是本地公式标记,人人都有。
  // 没绑的人在原位看到「绑定 WCA 账号」:注册那步跳过了、或后来才拿到 WCA ID,都从这里回来。
  const wcaId = user?.wcaId;
  const isAdmin = hasAdminAccess(user);
  const cards = [
    {
      key: 'onboarding',
      href: '/?guide=true',
      icon: <Lightbulb size={22} className="account-card-icon" />,
      title: tr({ zh: '新手指南', en: 'Beginner guide' }),
    },

    ...(wcaId ? [
      {
        key: 'wca',
        href: `/wca/persons/${wcaId}`,
        icon: <IdCard size={22} className="account-card-icon" />,
        title: tr({ zh: '成绩', en: 'Results' }),
      },
      {
        key: 'recon',
        href: `/recon/person/${wcaId}`,
        icon: <Rewind size={22} className="account-card-icon" />,
        title: tr({ zh: '复盘', en: 'Reconstructions' }),
      },
    ] : [
      {
        key: 'link-wca',
        href: accountHref('signin'),
        icon: <img src="/icons/wca.svg" alt="" width={22} height={22} className="account-card-icon" />,
        title: tr({ zh: '绑定 WCA 账号', en: 'Link your WCA account' }),
        desc: tr({ zh: '把比赛成绩、个人纪录和复盘接进来', en: 'Bring your results, records and reconstructions here' }),
      },
    ]),
    {
      key: 'progress',
      href: '/alg/progress',
      icon: <GraduationCap size={22} className="account-card-icon" />,
      title: tr({ zh: '学习进度', en: 'Learning Progress' }),
    },
    {
      key: 'learning-center',
      href: '/learn',
      icon: <BookOpen size={22} className="account-card-icon" />,
      title: tr({ zh: '学习中心', en: 'Learning Center' }),
    },
    {
      key: 'enterprise',
      href: '/org',
      icon: <Building2 size={22} className="account-card-icon" />,
      title: tr({ zh: '企业信息', en: 'Enterprise' }),
    },
    {
      key: 'friends',
      href: '/friends',
      icon: <Users size={22} className="account-card-icon" />,
      title: tr({ zh: '好友', en: 'Friends' }),
    },
    {
      key: 'vault',
      href: '/vault',
      icon: <LockKeyhole size={22} className="account-card-icon" />,
      title: tr({ zh: '私密资料库', en: 'Private vault' }),
    },
    {
      key: 'notifications',
      href: '/notifications',
      icon: <Bell size={22} className="account-card-icon" />,
      title: tr({ zh: '消息', en: 'Notifications' }),
    },
    ...(isAdmin ? [
      {
        key: 'mcp', href: '/account/mcp', icon: <LockKeyhole size={22} className="account-card-icon" />,
        title: tr({ zh: 'ChatGPT 只读连接', en: 'ChatGPT read-only connection' }),
      },
      {
        key: 'users-admin',
        href: '/admin',
        icon: <UserCog size={22} className="account-card-icon" />,
        title: tr({ zh: '管理后台', en: 'Administration' }),
        desc: tr({ zh: '用户增长、会员、赞助与审核', en: 'User growth, memberships, sponsorships, and moderation' }),
      },
      {
        key: 'submissions',
        href: accountHref('submissions'),
        icon: <Inbox size={22} className="account-card-icon" />,
        title: tr({ zh: '公式投稿', en: 'Algorithm submissions' }),
      },
    ] : []),
  ];

  return (
    <div className={`account-page${mode === 'me' && !pendingIdentity ? view === 'signin' ? ' account-page-settings' : view === 'main' ? ' account-page-main' : '' : ''}`}>
      <header className="account-header">
        {/* 面包屑往上一层:设置视图回「我的」,主视图回首页。设置视图里**不再放齿轮** ——
            人已经在里面了,亮着的齿轮长得像入口却干着出口的活,没人读得出来。
            一个方向一个入口:进设置靠齿轮,出设置靠这条面包屑。 */}
        {view === 'user' ? (
          <AppLink href="/friends" className="account-back" prefetch={false}>
            <ChevronLeft size={16} />
            <span>{t('好友', 'Friends')}</span>
          </AppLink>
        ) : view === 'signin' || view === 'submissions' ? (
          <AppLink href={accountHref()} className="account-back" prefetch={false}>
            <ChevronLeft size={16} />
            <span>{t('我的', 'My account')}</span>
          </AppLink>
        ) : view === 'delete' ? (
          /* 注销是设置里再往里一层,退一步回设置(而不是一路弹回「我的」)—— 面包屑跟着层级走。 */
          <AppLink href={accountHref('signin')} className="account-back" prefetch={false}>
            <ChevronLeft size={16} />
            <span>{t('账号设置', 'Account settings')}</span>
          </AppLink>
        ) : (
          <HomeLink className="account-back" miniProgramTarget="account">
            <ChevronLeft size={16} />
            <span>{t('返回', 'Back')}</span>
          </HomeLink>
        )}

      </header>

      {pendingIdentity ? <IdentityChoicePanel pending={pendingIdentity} firstPartyOnly={mobileAuth && !mobileAuthProvider} onCancel={() => setMode(useAuthStore.getState().user ? 'me' : 'login')} onDone={(info, returnPath) => {
        const original = new URL(returnPath, window.location.href);
        if (/^\/(zh\/)?account$/.test(original.pathname)) {
          next.current = safeNext(new URLSearchParams(original.hash.slice(1)).get('next')) ?? safeNext(original.searchParams.get('next'));
        } else next.current = returnPath;
        if (original.searchParams.get('auth') === 'mobile') { leave(); return; }
        if (info.isNew && !info.hasWca) setMode('onboard'); else leave();
      }} /> : mode === 'login' ? (
        <div data-mobile-auth-entry>
          {linkProvider === 'apple' ? <p>{t('请先在浏览器中登录与 App 相同的账号，再主动点击绑定 Apple。', 'Sign in to the same account as your app in this browser, then choose Link next to Apple.')}</p> : null}
          <LoginForm firstPartyOnly={mobileAuth && !mobileAuthProvider} onDone={settle} />
        </div>
      ) : mode === 'onboard' ? (
        /* 注册流程的最后一步。这里不渲染账号页本体(名字、卡片)—— 人还在「注册」这件事里,
           把「我的」摊开会让人以为已经结束了,而这一步恰恰要他做个选择。 */
        <WcaLinkPrompt returnTo={next.current} onSkip={leave} />
      ) : view === 'delete' ? (
        /* 同理,注销这一屏也只有它自己:名字和入口卡片留在这儿,读起来像「你的东西都还在」,
           正好和这一屏要说的话相反。 */
        <DeleteAccountPanel backHref={accountHref('signin')} />
      ) : view === 'user' ? (
        isAdmin && managedUserId && managedUserId > 0
          ? <AdminUserEditor userId={managedUserId} />
          : <p className="auth-error" role="alert">{t('只有管理员可以编辑用户资料。', 'Only administrators can edit user profiles.')}</p>
      ) : (
        <>
          <div className="account-id-row account-identity-heading">
            <AvatarEditor />
            <div className="account-identity-details">
            <div className="account-name-row">
              <AccountName name={user?.name || ''} wcaId={wcaId} />
              <div className="account-name-actions-row">
                {view !== 'signin' && !commerceRestricted && (
                  <AppLink href="/membership" className="account-subscribe" prefetch={false}>
                    <Crown size={20} aria-hidden="true" />
                    <span>{t('订阅会员', 'Subscribe to membership')}</span>
                  </AppLink>
                )}
                {mode === 'me' && view === 'main' && (
                  <AppLink
                    href={accountHref('signin')}
                    className="account-gear"
                    title={t('账号设置', 'Account settings')}
                    aria-label={t('账号设置', 'Account settings')}
                    prefetch={false}
                  >
                    <Settings size={28} />
                  </AppLink>
                )}
              </div>
            </div>
            <UserIdLabel userId={user?.uid} full />
            </div>
          </div>

          {view === 'signin' ? (
            <div className="account-settings-layout">
              <section className="account-settings-profile">
              <DisplayNameEditor />
              <AppLink href="/account/verify" className="account-card account-profile-editor" prefetch={false}>
                <IdCard size={22} className="account-card-icon" />
                <span className="account-card-title">{t('实名认证', 'Identity Verification')}</span>
              </AppLink>
              </section>
              <section className="account-creds">
              <h2 className="account-creds-title">{t('登录方式', 'Sign-in methods')}</h2>
              <AccountPanel
                expectedAppleUid={linkProvider === 'apple' ? expectedLinkUid : undefined}
                miniProgramLogin={miniProgramAction === 'login'}
              />
              {/* 清掉 ?view= —— 否则重新登录后会莫名其妙落在登录方式视图 */}
              <button type="button" className="account-logout" onClick={handleLogout}>
                <LogOut size={14} />
                <span>{t('退出', 'Log out')}</span>
              </button>
              {/* 注销入口:压在设置最底、与上面拉开一大段,存在但不招手 —— 真要找的人找得到,
                  顺着往下读的人不会误触。真 <a>,进的是独立一屏(?view=delete),不是弹窗。 */}
              <AppLink href={accountHref('delete')} className="account-delete" prefetch={false}>
                {t('注销账号', 'Delete account')}
              </AppLink>
            </section>
            </div>
          ) : (
            <>
              <AccountCardGrid cards={[
                { id: 'pet', content: <PetAccountCard /> },
                ...cards.map(({ key, href, icon, title, desc }) => ({
                  id: key,
                  content: <AppLink href={href} className="account-card" prefetch={false}>
                    {icon}
                    <div className="account-card-body">
                      <div className="account-card-title">{title}</div>
                      {desc && <div className="account-card-desc">{desc}</div>}
                    </div>
                  </AppLink>,
                })),
              ]} />

              {/* 公式库校验汇总 —— 组件自己判 admin,非管理员什么都不渲染、也不扫 */}
              <AlgValidationAlert />

              {/* 全站页面通知总览(哪些页挂着维护中 / WIP 条)—— 同样自己判 admin */}
              <PageNoticesAdmin />

              <FollowedComps isZh={uiLang === 'zh'} lang={uiLang} />
            </>
          )}
        </>
      )}

      {mode === 'me' && isAdmin && view === 'submissions' && (
        <AdminSubmissionsPanel
          lang={uiLang}
          onClose={() => { void setView(null, { history: 'replace' }); }}
        />
      )}
    </div>
  );
}
