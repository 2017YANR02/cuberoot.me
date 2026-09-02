'use client';

import {
  CONTACT_GROUP_SECTIONS,
  CONTACT_JOIN_INSTRUCTION,
  CONTACT_WEBSITE,
  CONTACT_WECHAT_ID,
  type ContactText,
} from '@cuberoot/shared/contact';
import BackHome from '@/components/BackHome';
import AppLink from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import ContactDetails from './ContactDetails';
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

  return (
    <main className="contact-page">
      <header className="contact-header">
        <BackHome />
        <p className="contact-eyebrow">{tr({ zh: '联系与社群', en: 'CONTACT & COMMUNITY' })}</p>
        <h1>{tr({ zh: '联系方式', en: 'Contact' })}</h1>
      </header>

      <section className="contact-profile">
        <div className="contact-profile-copy">
          <span className="contact-site-label">{tr({ zh: '网站', en: 'Website' })}</span>
          <AppLink href="/" className="contact-site">{CONTACT_WEBSITE}</AppLink>
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
        {CONTACT_GROUP_SECTIONS.map((section, sectionIndex) => (
          <section className="contact-section" aria-labelledby={section.id} key={section.id}>
            <div className="contact-section-heading">
              <span aria-hidden>{String(sectionIndex + 1).padStart(2, '0')}</span>
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
    </main>
  );
}
