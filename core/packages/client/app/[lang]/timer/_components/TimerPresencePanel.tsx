'use client';

import { Fragment } from 'react';
import { Bluetooth, Globe2, Timer, UserRound, Users } from '@app-foundation/icons/lucide';
import { useTranslation } from 'react-i18next';
import { EventIcon } from '@/components/EventIcon';
import { tr } from '@/i18n/tr';
import { CompactSelect } from '@/components/CompactSelect';
import { eventDisplayName } from '@/lib/wca-events';
import { formatMs } from '../_lib/stats';
import type { TimerPresenceResult, TimerPresenceSnapshot } from '../_lib/presence';

function resultText(result: TimerPresenceResult): string {
  if (result.penalty === 'DNF' || result.penalty === 'dnf') return 'DNF';
  if (result.penalty === 'DNS') return 'DNS';
  if (result.penalty === '+2') return `${formatMs(result.timeMs + 2000)}+`;
  return formatMs(result.timeMs);
}

export default function TimerPresencePanel({ snapshot }: { snapshot: TimerPresenceSnapshot | null }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const title = tr({ zh: '当前在线', en: 'Currently online' });
  const value = (n: number | undefined) => n === undefined ? '—' : String(n);
  const hasLocation = snapshot?.sessions.some(session => session.location) ?? false;
  const modeLabel = (mode: 'solo' | 'local' | 'net') => ({
    solo: tr({ zh: '单人', en: 'Solo' }),
    local: tr({ zh: '本机对战', en: 'Local battle' }),
    net: tr({ zh: '联机', en: 'Online' }),
  })[mode];

  return (
    <CompactSelect
      className="timer-presence"
      triggerClassName="timer-presence-trigger"
      popupClassName="timer-presence-panel"
      unstyledTrigger
      showArrow={false}
      ariaLabel={title}
      label={<><Users size={13} /><span className="timer-presence-total">{value(snapshot?.total)}</span></>}
      items={[]}
      onChange={() => {}}
      panelContent={<>
          <div className="timer-presence-title">{title}</div>
          <div className="timer-presence-summary">
            <span><Timer size={14} />{tr({ zh: '普通', en: 'Regular' })} <strong>{value(snapshot?.normal)}</strong></span>
            <span className="is-smart"><Bluetooth size={14} />{tr({ zh: '智能', en: 'Smart' })} <strong>{value(snapshot?.smart)}</strong></span>
          </div>
          {snapshot?.sessions.length ? (
            <div className="timer-presence-sessions">
              {snapshot.sessions.map(session => {
                const events = session.events?.length
                  ? session.events
                  : Array.from(new Set(session.results.map(result => result.event)));
                const players = session.players ?? Math.max(1, session.normal + session.smart);
                return (
                  <section className="timer-presence-session" key={session.sessionId}>
                    <div className="timer-presence-session-head">
                      <UserRound size={14} />
                      <strong>{session.account?.name || tr({ zh: '未登录', en: 'Signed out' })}</strong>
                      <span>{tr({ zh: `${players}人`, en: `${players}P` })}</span>
                      <span>{modeLabel(session.mode)}</span>
                    </div>
                    {events.length > 0 && (
                      <div className="timer-presence-meta is-events">
                        {events.map((event, index) => (
                          <Fragment key={event}>
                            {index > 0 && <span aria-hidden="true">/</span>}
                            <EventIcon event={event} />
                            <span>{eventDisplayName(event, isZh)}</span>
                          </Fragment>
                        ))}
                      </div>
                    )}
                    {session.account && (
                      <div className="timer-presence-meta">
                        {session.account.wcaId || session.account.ownerId}
                      </div>
                    )}
                    <div className="timer-presence-meta">
                      <Globe2 size={13} />
                      <span>
                        {session.location ? `${tr(session.location)} ${session.ip}` : session.ip}
                      </span>
                    </div>
                    {session.devices.map(device => (
                      <div className="timer-presence-meta" key={device.id || device.name}>
                        <Bluetooth size={13} />
                        <span>{device.name}</span>
                        {device.id && <code>{device.id}</code>}
                      </div>
                    ))}
                    {session.results.map((result, index) => (
                      <div className="timer-presence-result" key={`${result.label || ''}-${result.event}-${result.at || index}`}>
                        <span>{result.label ? `${result.label} ` : ''}{eventDisplayName(result.event, isZh)}</span>
                        <strong>{resultText(result)}</strong>
                      </div>
                    ))}
                  </section>
                );
              })}
              {hasLocation && (
                <a
                  className="timer-presence-attribution"
                  href="https://db-ip.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  IP Geolocation by DB-IP
                </a>
              )}
            </div>
          ) : (
            <div className="timer-presence-empty">{tr({ zh: '当前无人计时', en: 'No active timers' })}</div>
          )}
      </>}
    />
  );
}
