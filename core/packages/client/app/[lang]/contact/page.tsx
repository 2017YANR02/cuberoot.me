'use client';

import { useEffect, useState } from 'react';
import { NavigationShell } from '@app-foundation/navigation-ui';
import { Contact, UserPlus, Users } from '@app-foundation/icons/lucide';
import '@app-foundation/navigation-ui/navigation.css';
import {
  CONTACT_GROUP_SECTIONS,
  CONTACT_JOIN_INSTRUCTION,
  CONTACT_WECHAT_ID,
  type ContactText,
} from '@cuberoot/shared/contact';
import BackHome from '@/components/BackHome';
import AppLink from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import ContactDetails from '@/components/ContactDetails';
import { useHashHighlight } from '@/hooks/useHashHighlight';
import './contact.css';

function GroupName({ name }: { name: ContactText }) {
  return (
    <li>
      <T
        zh={name.zh}
        en={<><span>{name.en}</span><small>{name.zh}</small></>}
      />
    </li>
  );
}

function JoinInstruction() {
  const instruction = tr(CONTACT_JOIN_INSTRUCTION);
  const [before, after] = instruction.split(CONTACT_WECHAT_ID);
  return <>{before}<strong>{CONTACT_WECHAT_ID}</strong>{after}</>;
}

export default function ContactPage() {
  const admin = useIsAdmin();
  const { hash, setHash } = useHashHighlight({ block: 'start' });
  const [activeId, setActiveId] = useState('contact-details');
  useEffect(() => {
    setActiveId(hash.slice(1) || 'contact-details');
  }, [hash]);
  const sections = [
    { id: 'contact-details', label: tr({ zh: '联系方式', en: 'Contact details' }), icon: <Contact size={18} /> },
    { id: 'contact-join-title', label: tr({ zh: '进群方法', en: 'How to join' }), icon: <UserPlus size={18} /> },
    ...CONTACT_GROUP_SECTIONS.map(section => ({ id: section.id, label: tr(section.title), icon: <Users size={18} /> })),
  ];

  return (
    <NavigationShell className="contact-navigation" mainClassName="contact-page"
      items={sections.map(section => ({ ...section, href: `#${section.id}`, active: activeId === section.id }))}
      labels={{ navigation: tr({ zh: '联系目录', en: 'Contact navigation' }), show: tr({ zh: '显示侧边栏', en: 'Show sidebar' }), hide: tr({ zh: '隐藏侧边栏', en: 'Hide sidebar' }), openMobile: tr({ zh: '打开导航', en: 'Open navigation' }), closeMobile: tr({ zh: '关闭导航', en: 'Close navigation' }) }}
      renderLink={props => <a {...props} onClick={() => { props.onClick?.(); setActiveId(props.href.slice(1)); setHash(props.href, { markActed: true }); }} />}
      header={toggle => <header className="contact-navigation-header">{toggle}<BackHome /><h1>{tr({ zh: '联系方式', en: 'Contact' })}</h1></header>}
    >
      <section id="contact-details" className="contact-profile">
        <div className="contact-profile-copy">
          {admin && (
            <div className="contact-membership-link">
              <AppLink href="/membership" className="contact-site">
                {tr({ zh: '会员页面 →', en: 'Membership page →' })}
              </AppLink>
            </div>
          )}
          <ContactDetails />
        </div>
      </section>

      <section className="contact-join" aria-labelledby="contact-join-title">
        <h2 id="contact-join-title">{tr({ zh: '进群方法', en: 'How to join' })}</h2>
        <p><JoinInstruction /></p>
      </section>

      <div className="contact-directory">
        {CONTACT_GROUP_SECTIONS.map((section) => (
          <section className="contact-section" aria-labelledby={section.id} key={section.id}>
            <div className="contact-section-heading">
              <div>
                <h2 id={section.id}>{tr(section.title)}</h2>
                <p>{tr(section.description)}</p>
              </div>
            </div>

            <div className="contact-blocks">
              {section.blocks.map((block) => (
                <div className="contact-block" key={block.title.zh}>
                  <h3>{tr(block.title)}</h3>
                  <ul className="contact-list">
                    {block.groups.map((name) => <GroupName name={name} key={name.zh} />)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </NavigationShell>
  );
}
