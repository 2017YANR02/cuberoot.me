'use client';

/**
 * /account —— 「我的」页,全站唯一。默认只展示当前登录者的数据；管理员可通过受保护的
 * user 视图编辑 CubeRoot 用户资料。公开资料仍各归各页(选手档案 /wca/persons/:id、
 * 选手复盘 /recon/person/:id),普通用户这里只放属于我的:账号凭据、学习进度、关注的比赛、登出。
 * 也没有登录弹层:未登录就直接渲染登录表单,登录后按 next 回到来处。一次性绑定令牌只从
 * fragment 续接,不能进入 query、服务端日志或 Referer。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsInteger, parseAsStringEnum } from 'nuqs';
import { Bell, BookOpen, Building2, ChevronLeft, HeartHandshake, LogOut, Settings, Rewind, IdCard, GraduationCap, Inbox, Loader2, Upload, UserRound, Users } from 'lucide-react';
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
import { DateInput } from '@/components/DateInput';
import { AccountPanel, LoginForm, WcaLinkPrompt, DeleteAccountPanel, type SignedIn } from '@/components/AuthPanel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from '@/hooks/useT';
import {
  ACCOUNT_BIRTH_DATE_MIN,
  DISPLAY_NAME_MAX_LENGTH,
  isValidDisplayName,
  normalizeDisplayName,
  type AccountBasicProfile,
  type AccountGender,
} from '@cuberoot/shared/account';
import { CLAWD_AVATAR_PRESETS, DEFAULT_CLAWD_AVATAR_PRESET, type ClawdAvatarPresetId } from '@cuberoot/shared/account-avatar';
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
import { clawdAvatarUrl } from '@/lib/account-avatar';
import { displayCuberName } from '@/lib/cuber-name-display';
import { loadFlagData, personFlagIso2 } from '@/lib/country-flags';
import { countryName } from '@/lib/country-name';
import { prepareImageUpload, uploadImageBlob } from '@/lib/image-upload';
import { toLocalIsoDate } from '@/lib/iso-date';
import { ADMIN_WCA_IDS, applySession, useAuthStore, safeNext, takeWcaLinkPrompt } from '@/lib/auth-store';
import { tr, useLang } from '@/i18n/tr';
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
  const user = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveChoice = async (choice: AvatarChoice) => {
    setSaving(true);
    setError(null);
    try {
      const session = await updateAvatar(choice);
      if (!applySession(session.token, session.user)) throw new Error('session persistence failed');
    } catch {
      setError(t('头像保存失败，请稍后重试。', 'Could not save the avatar. Try again later.'));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const prepared = await prepareImageUpload(file, 512);
      const image = await uploadImageBlob(prepared.dataB64, prepared.mime);
      const session = await updateAvatar({ kind: 'upload', imageId: image.id });
      if (!applySession(session.token, session.user)) throw new Error('session persistence failed');
    } catch (uploadError) {
      setError((uploadError as Error).message === 'unsupported_image_type'
        ? t('请选择 PNG、JPEG 或 WebP 图片。', 'Choose a PNG, JPEG, or WebP image.')
        : t('头像上传失败，请稍后重试。', 'Could not upload the avatar. Try again later.'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
      setSaving(false);
    }
  };

  if (!user) return null;
  const selectedPreset = user.avatarPreset ?? DEFAULT_CLAWD_AVATAR_PRESET;
  const usingWcaAvatar = user.avatarSource === 'auto' && Boolean(user.wcaId);
  const usingDefaultClawd = user.avatarSource === 'clawd'
    || (user.avatarSource === 'auto' && !user.wcaId);

  return (
    <div className="account-avatar-editor">
      <div className={`account-avatar-preview${usingDefaultClawd ? ' is-clawd' : ''}`}>
        <img src={user.avatar} alt="" />
      </div>
      <div className="account-avatar-controls">
        <span className="account-avatar-label">{t('头像', 'Avatar')}</span>
        <div className="account-avatar-actions">
          <button type="button" className="auth-link" disabled={saving} onClick={() => fileRef.current?.click()}>
            <Upload size={13} aria-hidden="true" />
            {t('上传图片', 'Upload image')}
          </button>
          <input
            ref={fileRef}
            className="account-avatar-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          {saving && <Loader2 size={14} className="auth-spin" aria-label={t('正在保存', 'Saving')} />}
        </div>
      </div>
      <details className="account-avatar-picker">
        <summary>{t('选择 Clawd 头像', 'Choose a Clawd avatar')}</summary>
        {user.wcaId && (
          <button
            type="button"
            className={`account-wca-avatar-choice${usingWcaAvatar ? ' is-selected' : ''}`}
            aria-pressed={usingWcaAvatar}
            disabled={saving}
            onClick={() => void saveChoice({ kind: 'wca' })}
          >
            {t('使用 WCA 官方头像', 'Use official WCA avatar')}
          </button>
        )}
        <div className="account-clawd-grid">
          {CLAWD_AVATAR_PRESETS.map((preset) => {
            const selected = usingDefaultClawd && selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`account-clawd-choice${selected ? ' is-selected' : ''}`}
                aria-label={t(preset.zh, preset.en)}
                aria-pressed={selected}
                title={t(preset.zh, preset.en)}
                disabled={saving}
                onClick={() => void saveChoice({ kind: 'clawd', preset: preset.id as ClawdAvatarPresetId })}
              >
                <span className="account-clawd-image"><img src={clawdAvatarUrl(preset.id)} alt="" /></span>
                <span>{t(preset.zh, preset.en)}</span>
              </button>
            );
          })}
        </div>
      </details>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
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

  return (
    <>
      <div className="auth-idrow">
        <span className="auth-idicon"><UserRound size={16} /></span>
        <span className="auth-idprov">{t('用户名', 'Username')}</span>
        <span className="auth-iduid">{profile.name || t('未设置', 'Not set')}</span>
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
          {t('已绑定 WCA，用户名使用 WCA 实名。', 'WCA is linked, so your username uses your verified WCA name.')}
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
    if (!applySession(session.token, session.user)) throw new Error('session persistence failed');
  };
  return (
    <div className="account-profile-editor">
      <h2 className="account-creds-title">{t('个人资料', 'Profile')}</h2>
      <AvatarEditor />
      <DisplayNameField
        profile={{ name: user.name, wcaId: user.wcaId || null }}
        onSave={save}
      />
      <BasicProfileEditor />
    </div>
  );
}

type EditableBasicProfile = Pick<AccountBasicProfile, 'birthDate' | 'gender' | 'countryIso2'>;

function BasicProfileEditor() {
  const t = useT();
  const isZh = useLang() !== 'en';
  const [profile, setProfile] = useState<AccountBasicProfile | null>(null);
  const [draft, setDraft] = useState<EditableBasicProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = toLocalIsoDate();

  useEffect(() => {
    let cancelled = false;
    fetchAccountBasicProfile()
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setDraft({
          birthDate: next.birthDate,
          gender: next.gender,
          countryIso2: next.countryIso2,
        });
      })
      .catch(() => {
        if (!cancelled) setError(t('基本资料加载失败，请稍后重试。', 'Could not load your basic profile. Try again later.'));
      });
    return () => { cancelled = true; };
  }, [t]);

  if (!profile || !draft) {
    return error
      ? <p className="auth-error account-basic-profile-status" role="alert">{error}</p>
      : <p className="auth-hint account-basic-profile-status"><Loader2 size={14} className="auth-spin" />{t('正在加载基本资料…', 'Loading basic profile…')}</p>;
  }

  const countryLocked = profile.countrySource === 'wca';
  const dirty = draft.birthDate !== profile.birthDate
    || draft.gender !== profile.gender
    || (!countryLocked && draft.countryIso2 !== profile.countryIso2);
  const updateDraft = (patch: Partial<EditableBasicProfile>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setSaved(false);
    setError(null);
  };
  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await updateAccountBasicProfile({
        birthDate: draft.birthDate,
        gender: draft.gender,
        countryIso2: countryLocked ? profile.countryIso2 : draft.countryIso2,
      });
      setProfile(result.profile);
      setDraft({
        birthDate: result.profile.birthDate,
        gender: result.profile.gender,
        countryIso2: result.profile.countryIso2,
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
    { value: 'nonbinary', label: t('非二元', 'Non-binary') },
    { value: 'other', label: t('其他', 'Other') },
    { value: 'undisclosed', label: t('不愿透露', 'Prefer not to say') },
  ];

  return (
    <form className="account-basic-profile" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p className="auth-hint account-basic-profile-privacy">
        {t('以下资料默认不公开，仅用于账户归属与后续认领核验。', 'These details are private by default and are used for account ownership and future claim verification.')}
      </p>
      <div className="account-basic-profile-field">
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
      <div className="account-basic-profile-field">
        <label className="auth-label" htmlFor="account-gender">{t('性别', 'Gender')}</label>
        <select
          id="account-gender"
          className="auth-input account-basic-profile-select"
          value={draft.gender ?? ''}
          disabled={saving}
          onChange={(event) => updateDraft({ gender: (event.target.value || null) as AccountGender | null })}
        >
          <option value="">{t('未填写', 'Not set')}</option>
          {genderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="account-basic-profile-field">
        <label
          className="auth-label"
          id="account-country-label"
          htmlFor={countryLocked ? undefined : 'account-country'}
        >
          {t('国籍', 'Nationality')}
        </label>
        {countryLocked ? (
          <div className="account-basic-profile-country" aria-labelledby="account-country-label">
            {profile.countryIso2 ? (
              <>
                <Flag iso2={profile.countryIso2} spanClassName="country-flag" imgClassName="country-flag-ct" />
                <span>{countryName(profile.countryIso2, isZh)}</span>
              </>
            ) : <span>{t('WCA 暂未返回国籍', 'Nationality is not yet available from WCA')}</span>}
          </div>
        ) : (
          <CountryInput
            id="account-country"
            ariaLabel={t('搜索并选择国籍', 'Search and choose nationality')}
            value={draft.countryIso2 ?? ''}
            placeholder={t('搜索国家或地区', 'Search country or region')}
            onChange={(iso2) => updateDraft({ countryIso2: iso2 ? iso2.toUpperCase() : null })}
          />
        )}
        {countryLocked && (
          <p className="auth-hint account-basic-profile-lock">
            {t('已绑定 WCA，国籍由 WCA 资料同步。', 'WCA is linked, so nationality is synced from your WCA profile.')}
          </p>
        )}
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

  // 'wait' = 还没判定(SSR / 正在跳走)—— auth-store 从 localStorage 同步初始化,服务端恒为
  // null,所以判定只能在挂载后做,渲染前固定空壳避免 hydration 错配。
  // 'onboard' = 刚注册完的那一步「你有 WCA ID 吗」,挡在回跳 next 之前。
  const [mode, setMode] = useState<'wait' | 'login' | 'onboard' | 'me'>('wait');
  const [mobileAuth, setMobileAuth] = useState(false);
  const next = useRef<string | null>(null);

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
    setMobileAuth(search.get('auth') === 'mobile');
    const fragmentNext = new URLSearchParams(window.location.hash.slice(1)).get('next');
    next.current = safeNext(fragmentNext) ?? safeNext(search.get('next'));
    const u = useAuthStore.getState().user;
    if (!u) { setMode('login'); return; }
    // 三方(微信/QQ/支付宝)注册那条路:授权是整页跳走再回来的,回来时人已不在 LoginForm 里,
    // 拿不到 onDone —— 靠回调页留下的标记把同一步引导接上。
    setMode(takeWcaLinkPrompt() && !u.wcaId ? 'onboard' : 'me');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === 'wait') return <div className="account-page" />;

  // 我的公开页入口 —— 只有绑了 WCA 的账号才有;学习进度是本地公式标记,人人都有。
  // 没绑的人在原位看到「绑定 WCA 账号」:注册那步跳过了、或后来才拿到 WCA ID,都从这里回来。
  const wcaId = user?.wcaId;
  const isAdmin = !!wcaId && ADMIN_WCA_IDS.includes(wcaId);
  const cards = [
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
        href: '/account?view=signin',
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
      key: 'teaching',
      href: '/org',
      icon: <Building2 size={22} className="account-card-icon" />,
      title: tr({ zh: '教学管理', en: 'Teaching' }),
    },
    {
      key: 'membership',
      href: '/membership',
      icon: <HeartHandshake size={22} className="account-card-icon" />,
      title: tr({ zh: '会员', en: 'Membership' }),
    },
    {
      key: 'friends',
      href: '/friends',
      icon: <Users size={22} className="account-card-icon" />,
      title: tr({ zh: '好友', en: 'Friends' }),
    },
    {
      key: 'notifications',
      href: '/notifications',
      icon: <Bell size={22} className="account-card-icon" />,
      title: tr({ zh: '消息', en: 'Notifications' }),
    },
    ...(isAdmin ? [{
      key: 'submissions',
      href: '/account?view=submissions',
      icon: <Inbox size={22} className="account-card-icon" />,
      title: tr({ zh: '公式投稿', en: 'Algorithm submissions' }),
    }] : []),
  ];

  return (
    <div className="account-page">
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
          <AppLink href="/account" className="account-back" prefetch={false}>
            <ChevronLeft size={16} />
            <span>{t('我的', 'My account')}</span>
          </AppLink>
        ) : view === 'delete' ? (
          /* 注销是设置里再往里一层,退一步回设置(而不是一路弹回「我的」)—— 面包屑跟着层级走。 */
          <AppLink href="/account?view=signin" className="account-back" prefetch={false}>
            <ChevronLeft size={16} />
            <span>{t('账号设置', 'Account settings')}</span>
          </AppLink>
        ) : (
          <HomeLink className="account-back">
            <ChevronLeft size={16} />
            <span>{t('首页', 'Home')}</span>
          </HomeLink>
        )}
        {mode === 'me' && view === 'main' && (
          <AppLink
            href="/account?view=signin"
            className="account-gear"
            title={t('账号设置', 'Account settings')}
            aria-label={t('账号设置', 'Account settings')}
            prefetch={false}
          >
            <Settings size={18} />
          </AppLink>
        )}
      </header>

      {mode === 'login' ? (
        <LoginForm firstPartyOnly={mobileAuth} onDone={settle} />
      ) : mode === 'onboard' ? (
        /* 注册流程的最后一步。这里不渲染账号页本体(名字、卡片)—— 人还在「注册」这件事里,
           把「我的」摊开会让人以为已经结束了,而这一步恰恰要他做个选择。 */
        <WcaLinkPrompt returnTo={next.current} onSkip={leave} />
      ) : view === 'delete' ? (
        /* 同理,注销这一屏也只有它自己:名字和入口卡片留在这儿,读起来像「你的东西都还在」,
           正好和这一屏要说的话相反。 */
        <DeleteAccountPanel backHref="/account?view=signin" />
      ) : view === 'user' ? (
        isAdmin && managedUserId && managedUserId > 0
          ? <AdminUserEditor userId={managedUserId} />
          : <p className="auth-error" role="alert">{t('只有管理员可以编辑用户资料。', 'Only administrators can edit user profiles.')}</p>
      ) : (
        <>
          <div className="account-id-row">
            <AccountName name={user?.name || ''} wcaId={wcaId} />
            <UserIdLabel userId={user?.uid} full />
          </div>

          {view === 'signin' ? (
            <section className="account-creds">
              <DisplayNameEditor />
              <h2 className="account-creds-title">{t('登录方式', 'Sign-in methods')}</h2>
              <AccountPanel />
              {/* 清掉 ?view= —— 否则重新登录后会莫名其妙落在登录方式视图 */}
              <button type="button" className="account-logout" onClick={() => { logout(); void setView(null); setMode('login'); }}>
                <LogOut size={14} />
                <span>{t('退出', 'Log out')}</span>
              </button>
              {/* 注销入口:压在设置最底、与上面拉开一大段,存在但不招手 —— 真要找的人找得到,
                  顺着往下读的人不会误触。真 <a>,进的是独立一屏(?view=delete),不是弹窗。 */}
              <AppLink href="/account?view=delete" className="account-delete" prefetch={false}>
                {t('注销账号', 'Delete account')}
              </AppLink>
            </section>
          ) : (
            <>
              <nav className="account-cards">
                {cards.map(({ key, href, icon, title, desc }) => (
                  <AppLink key={key} href={href} className="account-card" prefetch={false}>
                    {icon}
                    <div className="account-card-body">
                      <div className="account-card-title">{title}</div>
                      {desc && <div className="account-card-desc">{desc}</div>}
                    </div>
                  </AppLink>
                ))}
              </nav>

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
