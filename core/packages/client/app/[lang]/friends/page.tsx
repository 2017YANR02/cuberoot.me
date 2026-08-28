'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  Ban, Check, Loader2, LogIn, Search, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import AppLink from '@/components/AppLink';
import { Flag } from '@/components/Flag';
import { SearchInput } from '@/components/SearchInput';
import { UserIdLabel } from '@/components/UserIdLabel';
import { WcaPersonPicker } from '@/components/WcaPersonPicker';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { resolveAccountAvatar } from '@/lib/account-avatar';
import { useAuthStore } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import {
  acceptFriendRequest,
  blockUser,
  deleteFriendRequest,
  fetchFriends,
  removeWcaFriendContact,
  removeFriend,
  saveWcaFriendContact,
  searchFriendUsers,
  sendFriendRequest,
  unblockUser,
  type FriendRelationship,
  type FriendSearchUser,
  type FriendsOverview,
  type FriendUser,
  type WcaFriendContact,
} from '@/lib/friends-api';
import type { WcaPersonLite } from '@/lib/wca-api';
import './friends.css';

type View = 'friends' | 'requests' | 'blocked';
type WcaCandidate = {
  person: WcaPersonLite;
  registered: FriendSearchUser | null | undefined;
};

function UserIdentity({ user }: { user: FriendUser }) {
  const t = useT();
  const avatar = resolveAccountAvatar(user.avatarUrl, user.avatarPreset, user.avatarSource);
  const name = user.name || t('未命名用户', 'Unnamed user');
  const content = (
    <>
      <span className={`friends-avatar${avatar.isClawd ? ' is-clawd' : ''}`}>
        <img src={avatar.src} alt="" />
      </span>
      <span className="friends-identity-text">
        <strong>{name}</strong>
        <span className="friends-identifiers">
          <UserIdLabel userId={user.userId} />
          {user.wcaId && <span>{user.wcaId}</span>}
        </span>
      </span>
    </>
  );
  return user.wcaId ? (
    <AppLink href={`/wca/persons/${user.wcaId}`} className="friends-identity" prefetch={false}>
      {content}
    </AppLink>
  ) : <span className="friends-identity">{content}</span>;
}

function UserRow({
  user,
  relationship,
  busy,
  onAction,
}: {
  user: FriendUser;
  relationship: FriendRelationship;
  busy: boolean;
  onAction: (action: 'add' | 'accept' | 'reject' | 'cancel' | 'remove' | 'block' | 'unblock') => void;
}) {
  const t = useT();
  const confirmAction = (message: string, action: 'remove' | 'block') => {
    if (window.confirm(message)) onAction(action);
  };
  return (
    <div className="friends-user-row">
      <UserIdentity user={user} />
      <div className="friends-actions">
        {busy ? <Loader2 className="friends-spin" size={16} aria-label={t('处理中', 'Working')} /> : (
          <>
            {relationship === 'none' && (
              <button type="button" className="friends-action is-primary" onClick={() => onAction('add')}>
                <UserPlus size={14} />{t('加好友', 'Add friend')}
              </button>
            )}
            {relationship === 'incoming' && (
              <>
                <button type="button" className="friends-action is-primary" onClick={() => onAction('accept')}>
                  <Check size={14} />{t('接受', 'Accept')}
                </button>
                <button type="button" className="friends-action" onClick={() => onAction('reject')}>
                  <X size={14} />{t('拒绝', 'Decline')}
                </button>
              </>
            )}
            {relationship === 'outgoing' && (
              <button type="button" className="friends-action" onClick={() => onAction('cancel')}>
                <X size={14} />{t('撤回申请', 'Cancel request')}
              </button>
            )}
            {relationship === 'friends' && (
              <>
                <button
                  type="button"
                  className="friends-action"
                  onClick={() => confirmAction(t('确定要删除这位好友吗？', 'Remove this friend?'), 'remove')}
                >
                  <UserMinus size={14} />{t('删除好友', 'Remove')}
                </button>
                <button
                  type="button"
                  className="friends-action is-danger"
                  onClick={() => confirmAction(
                    t('拉黑后会同时删除好友关系和双方待处理申请，确定继续吗？', 'Blocking also removes the friendship and pending requests. Continue?'),
                    'block',
                  )}
                >
                  <Ban size={14} />{t('拉黑', 'Block')}
                </button>
              </>
            )}
            {relationship === 'blocked' && (
              <button type="button" className="friends-action" onClick={() => onAction('unblock')}>
                {t('解除拉黑', 'Unblock')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WcaContactIdentity({ contact, isZh }: { contact: WcaFriendContact; isZh: boolean }) {
  return (
    <AppLink href={`/wca/persons/${contact.wcaId}`} className="friends-identity" prefetch={false}>
      <span className="friends-wca-flag-wrap">
        <Flag iso2={contact.countryIso2} className="friends-wca-flag" />
      </span>
      <span className="friends-identity-text">
        <strong>{displayCuberName(contact.name, isZh)}</strong>
        <span className="friends-identifiers"><span>{contact.wcaId}</span></span>
      </span>
    </AppLink>
  );
}

function WcaContactRow({
  contact,
  isZh,
  busy,
  onRemove,
}: {
  contact: WcaFriendContact;
  isZh: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <div className="friends-wca-contact">
      <div className="friends-user-row">
        <WcaContactIdentity contact={contact} isZh={isZh} />
        <div className="friends-actions">
          {busy ? <Loader2 className="friends-spin" size={16} aria-label={t('处理中', 'Working')} /> : (
            <button type="button" className="friends-action" onClick={onRemove}>
              <UserMinus size={14} />{t('删除', 'Remove')}
            </button>
          )}
        </div>
      </div>
      <p className="friends-wca-notice">
        {t('WCA 选手，仅保存在你的列表中；对方尚未建立 CubeRoot 好友关系。', 'WCA competitor saved only to your list; no CubeRoot friendship has been established.')}
      </p>
    </div>
  );
}

function RegisteredWcaNotice({ relationship }: { relationship: FriendRelationship }) {
  const t = useT();
  if (relationship === 'friends') {
    return <>{t('该选手已注册 CubeRoot，并且已经是你的好友。', 'This competitor has registered with CubeRoot and is already your friend.')}</>;
  }
  if (relationship === 'incoming') {
    return <>{t('该选手已注册 CubeRoot，并且已经向你发送好友申请。', 'This competitor has registered with CubeRoot and has sent you a friend request.')}</>;
  }
  if (relationship === 'outgoing') {
    return <>{t('该选手已注册 CubeRoot，你的好友申请正在等待回应。', 'This competitor has registered with CubeRoot, and your friend request is awaiting a response.')}</>;
  }
  if (relationship === 'blocked') {
    return <>{t('该选手已注册 CubeRoot，但目前在你的黑名单中。', 'This competitor has registered with CubeRoot but is currently blocked by you.')}</>;
  }
  return <>{t('该选手已注册 CubeRoot，添加后会发送好友申请。', 'This competitor has registered with CubeRoot. Adding them sends a friend request.')}</>;
}

export default function FriendsPage() {
  const t = useT();
  const lang = useLang();
  const isZh = lang === 'zh';
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [mounted, setMounted] = useState(false);
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [results, setResults] = useState<FriendSearchUser[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyWcaId, setBusyWcaId] = useState<string | null>(null);
  const [wcaCandidate, setWcaCandidate] = useState<WcaCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<View>(['friends', 'requests', 'blocked'])
      .withDefault('friends')
      .withOptions({ history: 'push' }),
  );
  const [q, setQ] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ history: 'replace', scroll: false }),
  );

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await fetchFriends());
    } catch {
      setError(t('好友数据加载失败，请稍后重试。', 'Could not load friends. Try again later.'));
    }
  }, [t]);

  useEffect(() => {
    if (mounted && user) void load();
  }, [load, mounted, user]);

  useEffect(() => {
    if (!mounted || !user) return;
    const query = q.trim();
    if (!query) {
      setResults(null);
      return;
    }
    if (query.length < 2 && !/^\d+$/.test(query)) {
      setResults([]);
      return;
    }
    setResults(null);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchFriendUsers(query)
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch(() => {
          if (!cancelled) setError(t('搜索失败，请稍后重试。', 'Search failed. Try again later.'));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mounted, q, t, user]);

  const selectWcaPerson = async (person: WcaPersonLite | null) => {
    setError(null);
    if (!person) {
      setWcaCandidate(null);
      return;
    }
    if (user?.wcaId && user.wcaId.toUpperCase() === person.id.toUpperCase()) {
      setWcaCandidate(null);
      setError(t('不能添加自己为好友。', 'You cannot add yourself as a friend.'));
      return;
    }
    setWcaCandidate({ person, registered: undefined });
    try {
      const users = await searchFriendUsers(person.id);
      const registered = users.find((item) => item.wcaId?.toUpperCase() === person.id.toUpperCase()) ?? null;
      setWcaCandidate((current) => (
        current?.person.id === person.id ? { person, registered } : current
      ));
    } catch {
      setWcaCandidate((current) => current?.person.id === person.id ? null : current);
      setError(t('无法确认该选手是否已注册，请稍后重试。', 'Could not check whether this competitor has registered. Try again later.'));
    }
  };

  const act = async (target: FriendUser, action: 'add' | 'accept' | 'reject' | 'cancel' | 'remove' | 'block' | 'unblock') => {
    setBusyId(target.userId);
    setError(null);
    try {
      if (action === 'add') await sendFriendRequest(target.userId);
      else if (action === 'accept') await acceptFriendRequest(target.userId);
      else if (action === 'reject' || action === 'cancel') await deleteFriendRequest(target.userId);
      else if (action === 'remove') await removeFriend(target.userId);
      else if (action === 'block') await blockUser(target.userId);
      else await unblockUser(target.userId);
      await load();
      if (q.trim()) setResults(await searchFriendUsers(q.trim()));
      if (wcaCandidate?.registered) {
        const users = await searchFriendUsers(wcaCandidate.person.id);
        const registered = users.find((item) => item.wcaId?.toUpperCase() === wcaCandidate.person.id.toUpperCase()) ?? null;
        setWcaCandidate((current) => current?.person.id === wcaCandidate.person.id
          ? { ...current, registered }
          : current);
      }
    } catch {
      setError(t('操作失败，关系可能已变化，请刷新后重试。', 'The action failed. The relationship may have changed; refresh and try again.'));
    } finally {
      setBusyId(null);
    }
  };

  const addWcaContact = async (person: WcaPersonLite) => {
    setBusyWcaId(person.id);
    setError(null);
    try {
      await saveWcaFriendContact({
        wcaId: person.id,
        name: person.name,
        countryIso2: person.country_iso2.toLowerCase(),
      });
      await load();
      setWcaCandidate(null);
    } catch {
      setError(t('添加失败，请稍后重试。', 'Could not add this competitor. Try again later.'));
    } finally {
      setBusyWcaId(null);
    }
  };

  const deleteWcaContact = async (contact: WcaFriendContact) => {
    if (!window.confirm(t('从你的列表中删除这位 WCA 选手吗？', 'Remove this WCA competitor from your list?'))) return;
    setBusyWcaId(contact.wcaId);
    setError(null);
    try {
      await removeWcaFriendContact(contact.wcaId);
      await load();
    } catch {
      setError(t('删除失败，请稍后重试。', 'Could not remove this competitor. Try again later.'));
    } finally {
      setBusyWcaId(null);
    }
  };

  if (!mounted) return <div className="friends-page" />;

  const list = view === 'friends' ? overview?.friends : view === 'blocked' ? overview?.blocked : null;
  const hasMainItems = Boolean(list?.length || (view === 'friends' && overview?.wcaContacts.length));

  return (
    <div className="friends-page">
      <h1 className="friends-title">{t('好友', 'Friends')}</h1>

      {!user ? (
        <div className="friends-login">
          <p>{t('登录后可以添加好友、处理好友申请和管理黑名单。', 'Sign in to add friends, handle requests, and manage blocked users.')}</p>
          <button type="button" className="friends-action is-primary" onClick={login}>
            <LogIn size={15} />{t('登录', 'Sign in')}
          </button>
        </div>
      ) : (
        <>
          <div className="friends-tabs" role="tablist" aria-label={t('好友视图', 'Friends view')}>
            <button className="friends-tab" type="button" role="tab" aria-selected={view === 'friends'} onClick={() => void setView('friends')}>
              <Users size={15} />{t('好友', 'Friends')}
            </button>
            <button className="friends-tab" type="button" role="tab" aria-selected={view === 'requests'} onClick={() => void setView('requests')}>
              <UserPlus size={15} />{t('申请', 'Requests')}
            </button>
            <button className="friends-tab" type="button" role="tab" aria-selected={view === 'blocked'} onClick={() => void setView('blocked')}>
              <Ban size={15} />{t('黑名单', 'Blocked')}
            </button>
          </div>

          {view === 'friends' && (
            <section className="friends-search-section">
              <h2>{t('添加好友', 'Add friends')}</h2>
              <div className="friends-search-group">
                <span className="friends-search-label">{t('CubeRoot 用户', 'CubeRoot users')}</span>
                <SearchInput
                  value={q}
                  onChange={(value) => void setQ(value)}
                  className="friends-search"
                  inputClassName="friends-search-input"
                  placeholder={t('搜索用户名或 CubeRoot ID', 'Search username or CubeRoot ID')}
                  ariaLabel={t('搜索 CubeRoot 用户', 'Search CubeRoot users')}
                  autoComplete="off"
                />
                {q.trim() && results === null && <p className="friends-muted"><Search size={14} />{t('正在搜索…', 'Searching…')}</p>}
                {results && results.length === 0 && <p className="friends-muted">{t('没有找到已注册用户。', 'No registered users found.')}</p>}
                {results && results.length > 0 && (
                  <div className="friends-list">
                    {results.map((item) => (
                      <UserRow
                        key={item.userId}
                        user={item}
                        relationship={item.relationship}
                        busy={busyId === item.userId}
                        onAction={(action) => void act(item, action)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="friends-search-group">
                <span className="friends-search-label">{t('WCA 选手', 'WCA competitors')}</span>
                <WcaPersonPicker
                  value={wcaCandidate?.person ?? null}
                  onChange={(person) => void selectWcaPerson(person)}
                  placeholder={t('搜索 WCA 姓名或 WCA ID', 'Search WCA name or WCA ID')}
                  isZh={isZh}
                  className="friends-wca-picker"
                />
                {wcaCandidate && wcaCandidate.registered === undefined && (
                  <p className="friends-muted"><Loader2 className="friends-spin" size={14} />{t('正在确认注册状态…', 'Checking registration…')}</p>
                )}
                {wcaCandidate?.registered && (
                  <div className="friends-wca-candidate">
                    <UserRow
                      user={wcaCandidate.registered}
                      relationship={wcaCandidate.registered.relationship}
                      busy={busyId === wcaCandidate.registered.userId}
                      onAction={(action) => void act(wcaCandidate.registered as FriendSearchUser, action)}
                    />
                    <p className="friends-wca-notice">
                      <RegisteredWcaNotice relationship={wcaCandidate.registered.relationship} />
                    </p>
                  </div>
                )}
                {wcaCandidate && wcaCandidate.registered === null && (
                  <div className="friends-wca-candidate">
                    <div className="friends-user-row">
                      <WcaContactIdentity
                        contact={{
                          wcaId: wcaCandidate.person.id,
                          name: wcaCandidate.person.name,
                          countryIso2: wcaCandidate.person.country_iso2,
                        }}
                        isZh={isZh}
                      />
                      <div className="friends-actions">
                        {busyWcaId === wcaCandidate.person.id ? (
                          <Loader2 className="friends-spin" size={16} aria-label={t('处理中', 'Working')} />
                        ) : (
                          <button type="button" className="friends-action is-primary" onClick={() => void addWcaContact(wcaCandidate.person)}>
                            <UserPlus size={14} />{t('添加到列表', 'Add to list')}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="friends-wca-notice">
                      {t('该选手尚未注册 CubeRoot。添加后只会保存在你的列表中；对方不会收到申请，也暂时无法与你互动。', 'This competitor has not registered with CubeRoot. They will only be saved to your list and will not receive a request or be able to interact yet.')}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {error && <p className="friends-error" role="alert">{error}</p>}
          {!overview && !error && <p className="friends-muted"><Loader2 className="friends-spin" size={15} />{t('加载中…', 'Loading…')}</p>}

          {view === 'requests' && overview && (
            <div className="friends-request-groups">
              <section>
                <h2>{t('收到的申请', 'Received')}</h2>
                {overview.incoming.length === 0 ? (
                  <p className="friends-muted">{t('没有待处理的好友申请。', 'No pending friend requests.')}</p>
                ) : <div className="friends-list">{overview.incoming.map((item) => (
                  <UserRow key={item.userId} user={item} relationship="incoming" busy={busyId === item.userId} onAction={(action) => void act(item, action)} />
                ))}</div>}
              </section>
              <section>
                <h2>{t('已发送的申请', 'Sent')}</h2>
                {overview.outgoing.length === 0 ? (
                  <p className="friends-muted">{t('没有等待回应的申请。', 'No requests awaiting a response.')}</p>
                ) : <div className="friends-list">{overview.outgoing.map((item) => (
                  <UserRow key={item.userId} user={item} relationship="outgoing" busy={busyId === item.userId} onAction={(action) => void act(item, action)} />
                ))}</div>}
              </section>
            </div>
          )}

          {view !== 'requests' && overview && list && (
            <section className="friends-main-list">
              <h2>{view === 'blocked' ? t('黑名单', 'Blocked users') : t('我的好友', 'My friends')}</h2>
              {!hasMainItems ? (
                <p className="friends-muted">
                  {view === 'blocked' ? t('黑名单是空的。', 'Your blocked list is empty.') : t('还没有好友，可以从上方搜索添加。', 'No friends yet. Search above to add someone.')}
                </p>
              ) : (
                <div className="friends-list">
                  {list.map((item) => (
                    <UserRow
                      key={item.userId}
                      user={item}
                      relationship={view === 'blocked' ? 'blocked' : 'friends'}
                      busy={busyId === item.userId}
                      onAction={(action) => void act(item, action)}
                    />
                  ))}
                  {view === 'friends' && overview.wcaContacts.map((contact) => (
                    <WcaContactRow
                      key={`wca-${contact.wcaId}`}
                      contact={contact}
                      isZh={isZh}
                      busy={busyWcaId === contact.wcaId}
                      onRemove={() => void deleteWcaContact(contact)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
