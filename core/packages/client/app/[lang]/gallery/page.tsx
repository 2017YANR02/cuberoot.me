'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import dynamic from 'next/dynamic';
import { useMembership } from '@/hooks/useMembership';
import { useRequireMembership } from '@/hooks/useRequireMembership';
import { tr, useLang } from '@/i18n/tr';
import { hasAdminAccess, useAuthUser } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import { WcaPersonTeamBadge } from '@/components/WcaPersonTeamBadge';
import { uploadedImageUrl } from '@/lib/image-upload';
import { listGalleryPhotos, type GalleryPhoto } from '@/lib/gallery-api';
import './gallery.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import SpeedStacksDisplayIcon from '@/components/SpeedStacksDisplayIcon';
import { CompactSelect } from '@/components/CompactSelect';
import StackmatTimerArtwork from '@/components/StackmatTimerArtwork';
import { STACKMAT_GENERATIONS, STACKMAT_G5_SKINS, STACKMAT_G5_SKIN_LABELS, type StackmatGeneration, type StackmatG5Skin } from '@/components/stackmat-catalog';
import { saveBlob, svgBlob } from '@/lib/puzzle-image/image-export';

const MemberProfileEditor = dynamic(() => import('@/components/MemberProfileEditor'));
const GalleryReviewPanel = dynamic(() => import('@/components/GalleryReviewPanel'));

export default function GalleryPage() {
  const lang = useLang();
  const user = useAuthUser();
  const { profile, isMember, loading: membershipLoading, refresh } = useMembership();
  const requireMembership = useRequireMembership(isMember);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const displayRef = useRef<SVGSVGElement>(null);
  const [generation, setGeneration] = useState<StackmatGeneration>(5);
  const [skin, setSkin] = useState<StackmatG5Skin>('classic');
  const timerArtworkRef = useRef<SVGSVGElement>(null);
  const [videoDuration, setVideoDuration] = useState<10 | 60>(10);
  const [videoFps, setVideoFps] = useState<50 | 60 | 100 | 120>(60);
  const videoFilename = `stackmat-360p-${videoDuration}s-${videoFps}fps.mp4`;

  const loadPhotos = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const next = await listGalleryPhotos(signal);
      if (!signal?.aborted) setPhotos(next);
    } catch {
      if (!signal?.aborted) setFailed(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPhotos(controller.signal);
    return () => controller.abort();
  }, [loadPhotos]);

  const isZh = lang === 'zh';

  return (
    <main className="gallery-page">
      <header className="gallery-hero">
        <BackHome />
        <h1>{tr({ zh: '图库', en: 'Gallery' })}</h1>
        <p>{tr({
          zh: '魔方插画、视频素材，以及会员分享的比赛与生活照片。',
          en: 'Cubing illustrations, video assets and member photos of competitions and everyday life.',
        })}</p>
      </header>

      <section className="gallery-collection" aria-labelledby="gallery-artwork-title">
        <h2 id="gallery-artwork-title">{tr({ zh: '插画', en: 'Illustrations' })}</h2>
        <figure className="gallery-artwork">
          <SpeedStacksDisplayIcon ref={displayRef} size={350} variant="color"
            aria-hidden={false} role="img" aria-label={tr({ zh: 'Speed Stacks 大显', en: 'Speed Stacks tournament display' })} />
          <figcaption>
            <span>{tr({ zh: 'Speed Stacks 大显', en: 'Speed Stacks tournament display' })}</span>
            <button type="button" className="gallery-member-link" onClick={() => {
              if (displayRef.current) saveBlob(svgBlob(new XMLSerializer().serializeToString(displayRef.current)), 'speed-stacks-display.svg');
            }}>{tr({ zh: '下载 SVG', en: 'Download SVG' })}</button>
          </figcaption>
          <div className="gallery-video-download">
            <CompactSelect ariaLabel={tr({ zh: '视频时长', en: 'Video duration' })}
              label={videoDuration === 10 ? tr({ zh: '10 秒', en: '10 seconds' }) : tr({ zh: '1 分钟', en: '1 minute' })}
              items={[{ value: 10, label: tr({ zh: '10 秒', en: '10 seconds' }) }, { value: 60, label: tr({ zh: '1 分钟', en: '1 minute' }) }]}
              value={videoDuration} onChange={setVideoDuration} showArrow />
            <CompactSelect ariaLabel={tr({ zh: '视频帧率', en: 'Video frame rate' })}
              label={`${videoFps} FPS`} items={([50, 60, 100, 120] as const).map(value => ({ value, label: `${value} FPS` }))}
              value={videoFps} onChange={setVideoFps} showArrow />
            <a className="gallery-member-link" href={`/videos/stackmat/v1/${videoFilename}`} download={videoFilename}>
              {tr({ zh: '下载视频', en: 'Download video' })}
            </a>
            <span>360p · MP4</span>
          </div>
        </figure>
        <figure className="gallery-artwork gallery-artwork-g5">
          <StackmatTimerArtwork generation={generation} skin={skin} ref={timerArtworkRef} role="img"
            aria-label={tr({ zh: `史塔克${['一', '二', '三', '四', '五'][generation - 1]}代计时器`, en: `StackMat G${generation} timer` })} />
          <figcaption>
            <CompactSelect ariaLabel={tr({ zh: '计时器型号', en: 'Timer model' })}
              value={generation} label={`StackMat G${generation}`}
              items={STACKMAT_GENERATIONS.map(value => ({ value, label: `StackMat G${value}` }))} onChange={setGeneration}/>
            {generation === 5 && <CompactSelect ariaLabel={tr({ zh: '涂装', en: 'Design' })} value={skin}
              label={tr(STACKMAT_G5_SKIN_LABELS[skin])} items={STACKMAT_G5_SKINS.map(value => ({ value, label: tr(STACKMAT_G5_SKIN_LABELS[value]) }))} onChange={setSkin}/>}
            <button type="button" className="gallery-member-link" onClick={() => {
              if (timerArtworkRef.current) saveBlob(svgBlob(new XMLSerializer().serializeToString(timerArtworkRef.current)), `stackmat-g${generation}${generation === 5 ? '-' + skin : ''}.svg`);
            }}>{tr({ zh: '下载 SVG', en: 'Download SVG' })}</button>
          </figcaption>
        </figure>
      </section>

      {isMember && profile ? (
        <MemberProfileEditor
          key={`profile:${user?.uid}:${user?.wcaId}`}
          profile={profile}
          onSaved={() => { refresh(); void loadPhotos(); }}
        />
      ) : !membershipLoading && (
        <div className="gallery-member-gate">
          <p>{user
            ? tr({ zh: '会员可上传最多 8 张照片，并随时管理展示内容。', en: 'Members can upload up to 8 photos and manage what is shown.' })
            : tr({ zh: '登录并开通会员后，可上传照片到图库。', en: 'Sign in and become a member to upload photos to the gallery.' })}</p>
          <button type="button" onClick={() => requireMembership()} className="gallery-member-link">
            {tr({ zh: '上传照片', en: 'Upload photos' })}
          </button>
        </div>
      )}

      {hasAdminAccess(user) && <GalleryReviewPanel key={`review:${user?.uid}:${user?.wcaId}`} onReviewed={() => { refresh(); void loadPhotos(); }} />}

      <section className="gallery-collection" aria-labelledby="gallery-collection-title">
        <h2 id="gallery-collection-title">{tr({ zh: '会员照片', en: 'Member photos' })}</h2>
        {loading ? (
          <p className="gallery-state" aria-live="polite"><LoadingIndicator>{tr({ zh: '正在加载图库…', en: 'Loading the gallery…' })}</LoadingIndicator></p>
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
              const content = <>
                <img
                  src={`${uploadedImageUrl(photo.id)}?v=2`}
                  srcSet={`${uploadedImageUrl(photo.id)}/thumb/512?v=1&access=2 512w, ${uploadedImageUrl(photo.id)}/thumb/1024?v=1&access=2 1024w`}
                  onError={event => {
                    const image = event.currentTarget;
                    if (image.srcset) {
                      image.removeAttribute('srcset');
                      image.src = `${uploadedImageUrl(photo.id)}?v=2`;
                    }
                  }}
                  sizes="(max-width: 520px) calc((100vw - 40px) / 2), (max-width: 715px) calc((100vw - 44px) / 2), (max-width: 947px) calc((100vw - 56px) / 3), 263px"
                  alt={name}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>{photo.wcaId && <WcaPersonTeamBadge wcaId={photo.wcaId} linked={false} />}{name}</figcaption>
              </>;
              return (
                <figure className="gallery-photo" key={photo.id}>
                  {photo.wcaId ? <AppLink href={`/wca/persons/${photo.wcaId}`} prefetch={false}>{content}</AppLink> : content}
                </figure>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
