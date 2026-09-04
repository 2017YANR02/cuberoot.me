'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import MemberProfileEditor from '@/components/MemberProfileEditor';
import { useMembership } from '@/hooks/useMembership';
import { tr, useLang } from '@/i18n/tr';
import { nextQuery, useAuthStore } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import { uploadedImageUrl } from '@/lib/image-upload';
import { getPublicMemberProfile, listPublicMembers } from '@/lib/membership-api';
import './gallery.css';

interface GalleryPhoto {
  id: number;
  index: number;
  memberName: string;
  wcaId: string;
}

export default function GalleryPage() {
  const lang = useLang();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { membership, loading: membershipLoading, refresh } = useMembership();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const members = await listPublicMembers();
      // ponytail: batch this only if member count makes parallel profile fetches measurable.
      const profiles = await Promise.all(members.map(async (member) => ({
        member,
        profile: await getPublicMemberProfile(member.wcaId).catch(() => null),
      })));
      setPhotos(profiles.flatMap(({ member, profile }) => (profile?.imageIds ?? []).map((id, index) => ({
        id,
        index,
        memberName: member.name,
        wcaId: member.wcaId,
      }))));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPhotos(); }, [loadPhotos]);

  const isZh = lang === 'zh';
  const loginHref = `/account${nextQuery(pathname)}`;

  return (
    <main className="gallery-page">
      <header className="gallery-hero">
        <BackHome />
        <h1>{tr({ zh: '图库', en: 'Gallery' })}</h1>
        <p>{tr({
          zh: '收录 CubeRoot 会员分享的魔方、比赛与生活照片。',
          en: 'Photos of cubes, competitions, and everyday life shared by CubeRoot members.',
        })}</p>
      </header>

      {membership?.active ? (
        <MemberProfileEditor
          membership={membership}
          onSaved={() => { refresh(); void loadPhotos(); }}
        />
      ) : !membershipLoading && (
        <div className="gallery-member-gate">
          <p>{user
            ? tr({ zh: '会员可上传最多 8 张照片，并随时管理展示内容。', en: 'Members can upload up to 8 photos and manage what is shown.' })
            : tr({ zh: '登录并开通会员后，可上传照片到图库。', en: 'Sign in and become a member to upload photos to the gallery.' })}</p>
          <AppLink href={user ? '/membership' : loginHref} prefetch={false} className="gallery-member-link">
            {user ? tr({ zh: '查看会员', en: 'View membership' }) : tr({ zh: '去登录', en: 'Sign in' })}
          </AppLink>
        </div>
      )}

      <section className="gallery-collection" aria-labelledby="gallery-collection-title">
        <h2 id="gallery-collection-title">{tr({ zh: '会员照片', en: 'Member photos' })}</h2>
        {loading ? (
          <p className="gallery-state" aria-live="polite">{tr({ zh: '正在加载图库…', en: 'Loading the gallery…' })}</p>
        ) : failed ? (
          <div className="gallery-state" role="alert">
            <p>{tr({ zh: '图库暂时无法加载。', en: 'The gallery could not be loaded.' })}</p>
            <button className="gallery-retry" type="button" onClick={() => void loadPhotos()}>{tr({ zh: '重试', en: 'Try again' })}</button>
          </div>
        ) : photos.length === 0 ? (
          <p className="gallery-state">{tr({ zh: '还没有会员公开照片。', en: 'No members have shared public photos yet.' })}</p>
        ) : (
          <div className="gallery-grid">
            {photos.map((photo) => {
              const name = displayCuberName(photo.memberName, isZh);
              return (
                <figure className="gallery-photo" key={photo.id}>
                  <AppLink href={`/wca/persons/${photo.wcaId}`} prefetch={false}>
                    <img
                      src={uploadedImageUrl(photo.id)}
                      alt={`${name} ${photo.index + 1}`}
                      loading="lazy"
                      decoding="async"
                    />
                    <figcaption>{name}</figcaption>
                  </AppLink>
                </figure>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
