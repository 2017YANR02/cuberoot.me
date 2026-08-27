'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  Ban, Check, Loader2, LogIn, Search, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import AppLink from '@/components/AppLink';
import { SearchInput } from '@/components/SearchInput';
import { UserIdLabel } from '@/components/UserIdLabel';
import { useT } from '@/hooks/useT';
import { resolveAccountAvatar } from '@/lib/account-avatar';
import { useAuthStore } from '@/lib/auth-store';
import {
  acceptFriendRequest,
  blockUser,
  deleteFriendRequest,
  fetchFriends,
  removeFriend,
  searchFriendUsers,
  sendFriendRequest,
  unblockUser,
  type FriendRelationship,
  type FriendSearchUser,
  type FriendsOverview,
  type FriendUser,
} from '@/lib/friends-api';
import './friends.css';

type View = 'friends' | 'requests' | 'blocked';

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

export default function FriendsPage() {
  const t = useT();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [mounted, setMounted] = useState(false);
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [results, setResults] = useState<FriendSearchUser[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
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
    } catch {
      setError(t('操作失败，关系可能已变化，请刷新后重试。', 'The action failed. The relationship may have changed; refresh and try again.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!mounted) return <div className="friends-page" />;

  const list = view === 'friends' ? overview?.friends : view === 'blocked' ? overview?.blocked : null;

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
              <SearchInput
                value={q}
                onChange={(value) => void setQ(value)}
                className="friends-search"
                inputClassName="friends-search-input"
                placeholder={t('搜索用户名、CubeRoot ID 或 WCA ID', 'Search username, CubeRoot ID, or WCA ID')}
                ariaLabel={t('搜索用户', 'Search users')}
                autoComplete="off"
              />
              {q.trim() && results === null && <p className="friends-muted"><Search size={14} />{t('正在搜索…', 'Searching…')}</p>}
              {results && results.length === 0 && <p className="friends-muted">{t('没有找到可添加的用户。', 'No matching users found.')}</p>}
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
              {list.length === 0 ? (
                <p className="friends-muted">
                  {view === 'blocked' ? t('黑名单是空的。', 'Your blocked list is empty.') : t('还没有好友，可以从上方搜索添加。', 'No friends yet. Search above to add someone.')}
                </p>
              ) : <div className="friends-list">{list.map((item) => (
                <UserRow
                  key={item.userId}
                  user={item}
                  relationship={view === 'blocked' ? 'blocked' : 'friends'}
                  busy={busyId === item.userId}
                  onAction={(action) => void act(item, action)}
                />
              ))}</div>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
