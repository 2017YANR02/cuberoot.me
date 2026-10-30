'use client';
import './settings-typography.css';

// Desk-pet workspace — shared navigation plus independent conversations.
// The existing LandingSearch assistant owns each request/composer; the workspace
// only coordinates selection and page-session snapshots. Lazy-loaded by DeskPet.

import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, useCallback, useSyncExternalStore, type ComponentProps } from 'react';
import { NavigationShell, SidebarToggle, type NavigationItem, type NavigationLinkProps } from '@app-foundation/navigation-ui';
import { FaHouse } from 'react-icons/fa6';
import '@app-foundation/navigation-ui/navigation.css';
import { Check, Lock, LockOpen, ArrowLeft, ArrowRight, Pencil, Trash2, RotateCcw, Maximize2, Coffee, Sun, Heart, Home, Sparkles, Shuffle, MessageSquarePlus, Music, MessageSquare, SquarePen, Pin, Search, AudioLines, Settings, PawPrint, Bell, Ellipsis, X } from '@app-foundation/icons/lucide';
import type { DeskPetEntry } from '@cuberoot/shared/deskpet';
import { CompactSelect } from '@/components/CompactSelect';
import BoolToggle from '@/components/BoolToggle';
import { useDeskPetVisible } from '@/hooks/useDeskPetVisible';
import { useIsMobile } from '@/hooks/useIsMobile';
import CubeRootLogo from '@/components/CubeRootLogo';
import AssistantConversationView from '@/components/AssistantConversationView';
import { assistantConversations, assistantOwner } from '@/lib/assistant-conversations';
import ChatAccountMenu from '@/components/ChatAccountMenu';
import DonateModal from '@/components/DonateModal';
import FeedbackModal from '@/components/FeedbackModal';
import FloatingMetronome from '@/components/FloatingMetronome';
import { SEARCH_CARDS, isLandingSearchCardVisible } from '@/lib/landing-sections';
import { isAdmin, useAuthUser } from '@/lib/auth-store';
import { useFeedbackUnread, refreshFeedbackUnread } from '@/lib/feedback-unread';
import { tr } from '@/i18n/tr';
import type { DeskPetExitStyle } from '@/lib/deskpet-motion';
import { ClearButton } from '@/components/ClearButton';
import { Tooltip } from '@/components/Tooltip';
import { ResizeDivider } from '@app-foundation/navigation-ui/resize-divider';
import '@app-foundation/navigation-ui/resize-divider.css';

const CSS = `
.deskpet-search-workspace{position:fixed;left:0;right:0;top:0;height:100dvh;z-index:100010;overflow:hidden;
  background:var(--background);}
.deskpet-mobile-control{display:none;}
.deskpet-search-workspace:has(.landing-search-panel,.appearance-menu,.deskpet-detail-column,.site-assistant-embedded){z-index:100025;}
/* Accent options are portaled to body, outside the sidebar's stacking context. */
body:has(.deskpet-navigation .appearance-menu) .accent-color-menu{z-index:100030;}
.deskpet-navigation.af-navigation{--af-nav-expanded:144px;--af-nav-header-height:48px;--deskpet-divider-size:0.5px;
  --af-nav-width:clamp(58px,var(--deskpet-rail-width,58px),min(200px,calc(100vw - 240px)));
  --af-nav-panel-width:clamp(240px,var(--deskpet-panel-width,280px),calc(100vw - var(--af-nav-width)));
  --af-nav-sidebar-bg:var(--background);--af-nav-content-bg:transparent;--af-nav-text:var(--muted-foreground);
  --af-nav-font-size:0.875rem;--af-nav-outline:transparent;
  --af-nav-active:var(--accent);--af-nav-hover:transparent;
  --af-nav-selected:var(--accent-soft);height:100%;min-height:0;pointer-events:none;}
.deskpet-navigation[data-panel-visible='true'][data-panel-collapsed='false']{--af-nav-outline:var(--border-default);}
.deskpet-navigation .af-nav-body{height:calc(100% - var(--af-nav-header-height));}
.deskpet-navigation .af-nav-sidebar{pointer-events:auto;}
.deskpet-navigation .af-nav-sidebar .af-nav-row[data-active='true'] .af-nav-link{color:var(--foreground);background:var(--muted);}
.deskpet-navigation .af-nav-backdrop,.deskpet-navigation .af-nav-mobile-toggle{pointer-events:auto;}
.deskpet-navigation-header{display:flex;align-items:center;height:var(--af-nav-header-height);
  box-sizing:border-box;padding:0 10px;position:relative;z-index:2;pointer-events:auto;
  background:var(--background);}
.deskpet-navigation-header::after{content:'';position:absolute;bottom:0;right:0;
  left:calc(var(--af-nav-width) + 64px);height:var(--deskpet-divider-size);background:var(--border-default);pointer-events:none;}
.deskpet-navigation-header .af-nav-toggle{margin:0;}
.deskpet-home-logo{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;margin-left:auto;}
.deskpet-home-logo img{display:block;height:24px;width:auto;}
.deskpet-home-logo:focus-visible{outline:2px solid var(--ring);outline-offset:-2px;border-radius:8px;}
/* Native-window control colors sampled from the supplied macOS reference;
   this control keeps its red appearance independently of the site palette. */
.deskpet-navigation-header .deskpet-workspace-close{
  --window-close-top:#f8675b;--window-close-middle:#f34f46;--window-close-bottom:#ee695f;
  --window-close-rim:#ffb0a6;--window-close-glyph:#8c0000;
  position:relative;inset:auto;width:14px;height:14px;margin-inline:12px 15px;border-radius:50%;cursor:default;
  background:linear-gradient(var(--window-close-top),var(--window-close-middle) 52%,var(--window-close-bottom));
  box-shadow:inset 0 0 0 .5px var(--window-close-rim),inset 0 .5px .5px color-mix(in srgb,var(--window-close-rim) 70%,transparent);
  color:var(--window-close-glyph);transition:none;}
.deskpet-workspace-close .clear-btn-icon{width:12px;height:12px;opacity:0;}
.deskpet-workspace-close .clear-btn-icon path{stroke-width:1.4;}
.deskpet-workspace-close:is(:hover,:focus-visible) .clear-btn-icon{opacity:1;}
.deskpet-navigation-header .deskpet-workspace-close:active{
  background:linear-gradient(color-mix(in srgb,var(--window-close-top) 85%,black),
    color-mix(in srgb,var(--window-close-middle) 85%,black) 52%,color-mix(in srgb,var(--window-close-bottom) 85%,black));}
.deskpet-workspace-close:focus-visible{outline:2px solid var(--ring);outline-offset:3px;}
@media (hover:none){.deskpet-workspace-close .clear-btn-icon{opacity:1;}}
.deskpet-navigation .deskpet-search-main{display:flex;align-items:stretch;min-height:0;height:100%;padding:0;}
.deskpet-search-box{min-width:0;width:100%;height:100%;pointer-events:auto;}
.deskpet-conversation{height:100%;min-width:0;}
.deskpet-conversation[hidden]{display:none;}
.deskpet-conversation-title{display:flex;align-items:center;gap:10px;min-width:0;position:absolute;left:104px;right:64px;margin:0;padding:0 12px;border:0;background:transparent;color:var(--foreground);font:400 .875rem/1.5 var(--font-sans);text-align:left;cursor:pointer;transition:left 240ms ease;}
.deskpet-conversation-title::before{content:'';position:absolute;top:0;bottom:0;left:calc(-1 * var(--deskpet-divider-size));
  width:var(--deskpet-divider-size);background:var(--border-default);pointer-events:none;}
.deskpet-conversation-title svg{flex:none;}
.deskpet-conversation-title span,.deskpet-chat-list .af-nav-link span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.deskpet-navigation .deskpet-chat-list .af-nav-link{font-weight:400;gap:8px;}
.deskpet-chat-list .af-nav-link[aria-current='page']{font-weight:400;color:var(--foreground);background:var(--muted);}
.deskpet-chat-heading{display:flex;align-items:center;gap:8px;margin:0 4px 4px;font-size:1.05rem;font-weight:600;color:var(--foreground);}
.deskpet-chat-heading strong{flex:1;}
.deskpet-chat-action{display:inline-flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:var(--muted-foreground);cursor:pointer;}
.deskpet-chat-action:hover,.deskpet-chat-action:focus-visible{background:var(--accent-soft);color:var(--foreground);}
.deskpet-chat-bell{position:relative;}
.deskpet-chat-unread{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:var(--accent);}
.deskpet-chat-home{position:relative;display:flex;align-items:center;justify-content:center;width:18px;height:18px;}
.deskpet-chat-home .deskpet-chat-unread{top:-4px;right:-4px;width:8px;height:8px;}
.deskpet-reply-menu{z-index:100030;width:min(300px,calc(100vw - 24px));}
.deskpet-chat-menu{z-index:100030;}
.deskpet-chat-menu .compact-select-option{display:flex;align-items:center;gap:8px;}
.deskpet-reply-menu .compact-select-option{white-space:normal;text-align:left;}
.deskpet-reply-item{display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere;}
.deskpet-reply-item small,.deskpet-reply-empty{font-size:12px;color:var(--muted-foreground);}
.deskpet-reply-empty{margin:0;padding:12px;}
.deskpet-chat-section{margin:10px 10px 4px;font-size:.8rem;color:var(--muted-foreground);}
.deskpet-chat-row{display:flex;align-items:center;min-width:0;}
.deskpet-chat-row-actions{display:flex;align-items:center;flex:none;}
@media (hover:hover) and (pointer:fine){
  .deskpet-chat-row-actions{opacity:0;pointer-events:none;}
  .deskpet-chat-row:hover .deskpet-chat-row-actions,
  .deskpet-chat-row:focus-within .deskpet-chat-row-actions,
  .deskpet-chat-row-actions:has([aria-expanded="true"]){opacity:1;pointer-events:auto;}
}
.deskpet-chat-row .af-nav-link{flex:1;min-width:0;}
.deskpet-chat-row .af-nav-link>span:last-child{flex:1;min-width:0;text-overflow:clip;
  -webkit-mask-image:linear-gradient(to right,black calc(100% - 24px),transparent);
  mask-image:linear-gradient(to right,black calc(100% - 24px),transparent);}
.deskpet-chat-rename{display:flex;align-items:center;width:100%;min-width:0;}
.deskpet-chat-name-field{display:flex;align-items:center;flex:1;min-width:0;border:1px solid var(--input);border-radius:8px;background:var(--background);}
.deskpet-chat-name-field:focus-within{outline:2px solid var(--ring);outline-offset:1px;}
.deskpet-chat-name-field input{width:100%;min-width:0;padding:8px;border:0;outline:0;background:transparent;color:var(--foreground);font:inherit;}
.deskpet-chat-name-field .clear-btn{flex:none;}
.deskpet-chat-rename button:disabled{opacity:.4;cursor:default;}
.deskpet-chat-search{width:100%;box-sizing:border-box;margin:0 0 8px;padding:8px;border:1px solid var(--border-default);border-radius:8px;background:var(--background);color:var(--foreground);font:inherit;}
.deskpet-search-box:has(.landing-search-plus-menu){z-index:1;}
.deskpet-search-box .landing-search{margin:0;}
/* Results open above the bottom-anchored search. */
.deskpet-search-box .landing-search-panel{top:auto;bottom:calc(100% + 0.5rem);}
/* Adapt existing controls to the shared navigation rows. */
.deskpet-navigation .header-toggles,.deskpet-navigation .lang-toggle-wrap,
.deskpet-navigation .deskpet-character-select{width:100%;}
.deskpet-navigation .af-nav-link.char-btn{position:relative;justify-content:flex-start;}
.deskpet-navigation .char-btn .compact-select-current{display:contents;}
.deskpet-navigation .char-btn .compact-select-arrow{display:none;}
.deskpet-navigation .af-nav-link > svg,.deskpet-navigation .wca-auth-avatar,
.deskpet-navigation .wca-auth-fallback,.deskpet-toolbar-thumb{width:18px;height:18px;flex:0 0 18px;object-fit:contain;}
.deskpet-navigation .heart-icon{fill:var(--destructive);color:var(--destructive);}
.deskpet-navigation .af-nav-sidebar{position:static;top:auto;height:100%;}
.deskpet-navigation .af-nav-sidebar > div:last-child{height:100%;}
.deskpet-navigation .af-nav-sidebar .af-nav-menu{display:flex;flex-direction:column;height:100%;}
.deskpet-navigation .af-nav-sidebar .af-nav-row:has(.chat-account-trigger){margin-top:auto;padding-top:16px;}
.deskpet-navigation .appearance-menu[data-backgrounds],
.deskpet-navigation .deskpet-detail-column{pointer-events:auto;
  max-width:none;max-height:none;margin:0;padding:24px 16px;align-content:start;
  grid-template-columns:minmax(0,1fr);border:0;border-radius:0;
  box-shadow:inset var(--deskpet-divider-size) 0 0 var(--af-nav-outline),inset calc(-1 * var(--deskpet-divider-size)) 0 0 var(--af-nav-outline);}
.deskpet-navigation .appearance-menu[data-backgrounds='true']{grid-template-columns:minmax(0,1fr);}
.deskpet-navigation .appearance-menu[data-backgrounds='true'] .site-background-grid{grid-column:1;grid-row:3;margin-top:16px;}
.deskpet-navigation .deskpet-detail-column .deskpet-character-menu,
.deskpet-navigation .deskpet-detail-column :is(.cr-metro,.fb-modal,.donate-modal){position:relative;inset:auto;
  width:100%;max-width:none;max-height:none;visibility:inherit;padding:0;
  border:0;border-radius:0;box-shadow:none;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;}
.deskpet-detail-column .deskpet-character-menu{overflow:visible;}
.deskpet-detail-column .cr-metro{touch-action:auto;}
.deskpet-detail-column .cr-metro-grab{cursor:default;}
.deskpet-detail-column .donate-qr-row{flex-wrap:wrap;}
.deskpet-detail-column .donate-qr{min-width:0;}
.deskpet-navigation .deskpet-divider{position:fixed;top:var(--af-nav-header-height);pointer-events:auto;}
.deskpet-divider--rail{left:calc(var(--af-nav-width) - 12px);}
.deskpet-divider--panel{left:calc(var(--af-nav-width) + min(var(--af-nav-panel-width),100vw - var(--af-nav-width)) - 12px);}
.deskpet-navigation[data-panel-collapsed='true'] .deskpet-divider--panel{display:none;}
.deskpet-navigation:has(.resize-divider.is-dragging) :is(.af-nav-body,.af-nav-main,.af-nav-corner,.deskpet-conversation-title){transition:none;}
@media (min-width:768px){
  .deskpet-navigation[data-panel-visible='true'][data-panel-collapsed='false'] .deskpet-conversation-title{
    left:calc(var(--af-nav-width) + var(--af-nav-panel-width));
  }
  .deskpet-navigation.af-navigation{
    --af-nav-width:clamp(58px,var(--deskpet-rail-width,58px),min(200px,calc(100vw - 560px)));
    --af-nav-panel-width:clamp(240px,var(--deskpet-panel-width,280px),calc(100vw - var(--af-nav-width) - 320px));
  }
}
@media (max-width:767px){
  .deskpet-search-workspace{contain:layout;}
  .deskpet-navigation.af-navigation{--af-nav-header-height:calc(56px + env(safe-area-inset-top,0px));--af-nav-width:58px;--af-nav-panel-width:calc(100% - 58px);}
  .deskpet-navigation .af-nav-body{display:block;}
  .deskpet-navigation .af-nav-sidebar{display:none;position:absolute;inset:0 auto 0 0;width:58px;height:100%;z-index:2;padding:8px 6px;}
  .deskpet-search-workspace[data-mobile-panel='true'] .af-nav-sidebar{display:block;}
  .deskpet-navigation .af-nav-corner,.deskpet-navigation .deskpet-divider,.deskpet-navigation-header>.af-nav-toggle,
  .deskpet-navigation-header .deskpet-workspace-close{display:none;}
  .deskpet-navigation-header{padding:env(safe-area-inset-top,0px) max(8px,env(safe-area-inset-right,0px)) 0 max(8px,env(safe-area-inset-left,0px));gap:2px;}
  .deskpet-navigation-header::after,.deskpet-conversation-title::before{display:none;}
  .deskpet-mobile-control{display:inline-flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--foreground);cursor:pointer;}
  .deskpet-mobile-control .af-nav-toggle{width:44px;height:44px;margin:0;}
  .deskpet-mobile-control:focus-visible{outline:2px solid var(--ring);outline-offset:-2px;}
  .deskpet-conversation-title{position:static;flex:1;right:auto;left:auto;padding:0 6px;height:44px;}
  .deskpet-conversation-title>svg{display:none;}
  .deskpet-navigation .af-nav-link{min-height:44px;height:auto;margin-block:2px;padding-block:8px;}
  .deskpet-navigation[data-navigation] .af-nav-panel{position:fixed;top:var(--af-nav-header-height);bottom:0;left:58px;width:min(400px,calc(82vw - 58px));height:auto;z-index:2;box-shadow:0 0 0 100vmax color-mix(in srgb,var(--background) 65%,transparent);}
  .deskpet-navigation[data-panel-collapsed='true'] .af-nav-panel{clip-path:none;opacity:1;visibility:visible;pointer-events:auto;}
  .deskpet-navigation .deskpet-search-main{height:100%;box-sizing:border-box;padding:0;}
  .deskpet-search-workspace[data-mobile-panel='true'] .deskpet-search-box{pointer-events:none;}
  .deskpet-navigation .appearance-menu[data-backgrounds],.deskpet-navigation .deskpet-detail-column{padding:24px 12px max(16px,var(--sab,0px));}
}
@media (pointer:coarse){
  .deskpet-workspace-close::after{content:'';position:absolute;inset:-15px;}
}

/* anchored-panel: clamped (CompactSelect body portal and visualViewport bounds) */
.deskpet-character-menu{z-index:100030;width:min(360px,calc(100vw - 16px));}
.deskpet-character-menu .compact-select-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;}
.deskpet-character-menu .compact-select-options .compact-select-option{position:relative;justify-content:center;padding:10px 4px;min-width:0;}
.deskpet-character-menu .compact-select-options .deskpet-character-option{flex-direction:column;gap:4px;white-space:normal;text-align:center;overflow-wrap:anywhere;}
.deskpet-character-admin{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0;border-top:1px solid var(--border-default);}
.deskpet-character-admin button{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:32px;padding:6px;border:0;border-radius:6px;background:var(--muted);color:var(--foreground);font:inherit;cursor:pointer;}
.deskpet-character-admin button:disabled{opacity:.45;cursor:default;}
.deskpet-character-admin form{display:flex;flex-wrap:wrap;gap:6px;width:100%;}
.deskpet-character-admin label{display:flex;flex-direction:column;gap:4px;width:100%;}
.deskpet-character-admin input{min-width:0;width:100%;padding:6px;background:var(--background);color:var(--foreground);border:1px solid var(--border-default);border-radius:4px;}
.deskpet-character-lock{position:absolute;top:6px;right:6px;display:flex;}
.deskpet-character-status{display:flex;align-items:center;gap:4px;min-height:14px;color:var(--muted-foreground);}
.deskpet-character-error{color:var(--destructive);font-size:12px;}

.deskpet-character-menu .compact-select-option{padding:6px 10px;}
.deskpet-character-option{display:flex;align-items:center;gap:10px;white-space:nowrap;min-height:32px;}
.deskpet-character-thumb{display:flex;align-items:center;justify-content:center;width:32px;height:32px;overflow:hidden;flex:none;}
.deskpet-character-thumb img{width:32px;height:32px;object-fit:contain;}
.deskpet-character-compact{display:flex;align-items:center;justify-content:center;gap:5px;height:32px;padding:0 8px;border:1px solid var(--border-strong);border-radius:999px;background:var(--muted);}
.deskpet-character-check{flex:none;margin-left:2px;}
.deskpet-character-settings,.deskpet-character-gallery{margin-top:4px;padding-top:4px;border-top:1px solid var(--border-default);}
.deskpet-character-settings{display:flex;flex-direction:column;gap:2px;}
.deskpet-character-setting{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:6px 10px;font-size:13px;}
.deskpet-character-settings .bool-toggle{width:100%;justify-content:space-between;}
.deskpet-character-sizes{display:flex;gap:2px;}
.deskpet-character-menu .deskpet-character-size{width:auto;padding:6px 10px;white-space:nowrap;}
.deskpet-character-random .pill-toggle{flex:none;}

`;

export default function DeskPetSearch({
  open,
  lang,
  origin,
  onClose,
  character,
  characters,
  catalogAdmin, catalogDisabled, catalogError, onUpdateCatalog,
  size,
  resting,
  onSelectChar,
  onSelectSize,
  onToggleRest,
  onNaturalSleep,
  randomMode,
  onToggleRandom,
  exitStyle,
  onSelectExitStyle,
  onOpenPetHome,
}: {
  open: boolean;
  lang: 'zh' | 'en';
  origin?: { x: number; y: number } | null;
  onClose: () => void;
  character: string;
  characters: (DeskPetEntry & { label: { zh: string; en: string }; thumb: string; thumbScale?: number })[];
  catalogAdmin: boolean;
  catalogDisabled: boolean;
  catalogError: boolean;
  onUpdateCatalog: (entries: DeskPetEntry[]) => Promise<boolean>;
  size: 's' | 'm' | 'l';
  resting: boolean;
  onSelectChar: (character: string) => void;
  onSelectSize: (size: 's' | 'm' | 'l') => void;
  onToggleRest: () => void;
  onNaturalSleep?: (mode: 'drowsy' | 'sleep') => void;
  randomMode: boolean;
  onToggleRandom: () => void;
  exitStyle: DeskPetExitStyle;
  onSelectExitStyle: (value: string) => void;
  onOpenPetHome: () => void;
}) {
  const [petVisible, setPetVisible] = useDeskPetVisible();
  const user = useAuthUser();
  const mobile = useIsMobile(767);
  const owner = assistantOwner(user);
  const readConversations = useCallback(() => assistantConversations.read(owner), [owner]);
  const chats = useSyncExternalStore(assistantConversations.subscribe, readConversations, assistantConversations.serverSnapshot);
  const unreadReplies = chats.conversations.filter(chat => chat.unreadReply).slice().reverse();
  useEffect(() => {
    assistantConversations.restorePinned(owner);
    if (!assistantConversations.read(owner).conversations.length) assistantConversations.create(owner, crypto.randomUUID());
  }, [owner]);
  const newChat = () => {
    assistantConversations.create(owner, crypto.randomUUID());
    setActivePanel(window.matchMedia('(max-width:767px)').matches ? null : 'chats');
  };
  const selectChat = (id: string) => {
    assistantConversations.select(owner, id);
    if (window.matchMedia('(max-width:767px)').matches) setActivePanel(null);
  };
  const searchCards = SEARCH_CARDS.filter((card) => isLandingSearchCardVisible(card, isAdmin()));
  const workspaceRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<'chats' | 'pet' | 'music' | 'feedback' | 'donate' | null>(null);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [editingChat, setEditingChat] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => { if (mobile) setActivePanel(null); }, [mobile]);
  const [petPanelContainer, setPetPanelContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (activePanel) boxRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.blur();
  }, [activePanel]);
  const donateOpen = activePanel === 'donate';
  const feedbackOpen = activePanel === 'feedback';
  const setDonateOpen = (open: boolean) => setActivePanel(open ? 'donate' : null);
  const setFeedbackOpen = (open: boolean) => setActivePanel(open ? 'feedback' : null);
  const fbUnread = useFeedbackUnread();

  // 反馈按钮红点跟共享未读数;关掉反馈弹窗后复查一次(可能刚读过)。轮询由桌宠统一做。
  useEffect(() => {
    if (!feedbackOpen) refreshFeedbackUnread();
  }, [feedbackOpen]);
  const zh = lang === 'zh';
  const t = (z: string, e: string) => (zh ? z : e);
  const chatTitle = (id: string) => {
    const chat = chats.conversations.find(item => item.id === id);
    return (typeof chat?.title === 'string' && chat.title) || chat?.snapshot.turns[0]?.question || chat?.snapshot.draft.trim() || t('新聊天', 'New chat');
  };
  const currentCharacter = characters.find(item => item.id === character);
  const [editingName, setEditingName] = useState(false);
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  useEffect(() => { setEditingName(false); }, [character]);
  const catalogEntries = () => characters.map(({ id, locked, removed, label }) => ({ id, locked, removed, label }));
  const patchCharacter = (patch: Partial<DeskPetEntry>) => onUpdateCatalog(catalogEntries().map(entry => entry.id === character ? { ...entry, ...patch } : entry));
  const moveCharacter = (delta: number) => {
    const entries = catalogEntries();
    const index = entries.findIndex(entry => entry.id === character);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    void onUpdateCatalog(entries);
  };

  // Entrance: the box grows from the pet's position out to its centered spot.
  useLayoutEffect(() => {
    if (!open) return;
    const box = boxRef.current, backdrop = workspaceRef.current;
    if (!box) return;
    // Focus synchronously in the commit phase: on touch this still runs inside
    // the tap gesture, so mobile browsers raise the keyboard (a deferred
    // useEffect would land after the gesture and silently fail on iOS).
    if (!window.matchMedia('(pointer:coarse)').matches) box.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const backdropAnimation = backdrop?.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 200, easing: 'ease-out', fill: 'both' });

    const r = box.getBoundingClientRect();
    const from = origin ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dx = from.x - (r.left + r.width / 2);
    const dy = from.y - (r.top + r.height / 2);
    const boxAnimation = box.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ], { duration: 260, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'both' });
    return () => { backdropAnimation?.cancel(); boxAnimation.cancel(); };
  }, [origin, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open], .chat-account-menu')) return;
      if (e.key === 'Escape' && editingChat) {
        e.preventDefault();
        e.stopPropagation();
        setEditingChat(null);
        return;
      }
      if (e.key === 'Escape' && document.querySelector('.deskpet-reply-menu, .deskpet-chat-menu')) return;
      // Check before the shared menu's document handler dismisses it.
      if (e.key === 'Escape' && activePanel && !donateOpen && !feedbackOpen) {
        setActivePanel(null);
        return;
      }
      if (e.key === 'Escape' && !donateOpen && !feedbackOpen
        && !document.querySelector('.deskpet-character-menu, .deskpet-gallery-overlay, .deskpet-navigation .appearance-menu, .deskpet-navigation[data-mobile-open="true"]')) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, donateOpen, feedbackOpen, activePanel, open, editingChat?.id]);

  // Prefetch the donate QRs on hover, not on open: fetching them at mount put two
  // WebPs on the wire during the entrance animation for every user who opens
  // search, and almost none of them head for the donate button. Pointer-enter
  // still lands well before the click, so the modal opens with the QRs ready.
  const donatePrefetched = useRef(false);
  const prefetchDonate = () => {
    if (donatePrefetched.current) return;
    donatePrefetched.current = true;
    ['/donate/alipay.webp', '/donate/wechat.webp'].forEach((href) => {
      const img = new Image();
      img.src = href;
    });
  };

  // Mobile keyboard: position:fixed tracks the layout viewport, which doesn't
  // shrink when the on-screen keyboard opens — so the bottom-anchored box ends
  // up hidden behind it. Pin the backdrop to the visual viewport instead, so
  // align-items:flex-end keeps the search box just above the keyboard.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const b = workspaceRef.current;
      if (!b) return;
      const height = `${vv.height}px`, top = `${vv.offsetTop}px`;
      const width = `${vv.width}px`, left = `${vv.offsetLeft}px`;
      if (b.style.height !== height) b.style.height = height;
      if (b.style.top !== top) b.style.top = top;
      if (b.style.width !== width) b.style.width = width;
      if (b.style.left !== left) b.style.left = left;
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
    };
  }, [open]);

  const resizeColumn = (handle: HTMLElement, requested: number, column: 'rail' | 'panel') => {
    const navigation = handle.closest<HTMLElement>('.deskpet-navigation');
    if (!navigation) return;
    const available = workspaceRef.current?.clientWidth ?? window.innerWidth;
    const contentMinimum = available >= 768 ? 320 : 0;
    const railWidth = navigation.querySelector('.af-nav-sidebar')?.getBoundingClientRect().width ?? 58;
    const minimum = column === 'rail' ? 58 : 240;
    const maximum = column === 'rail' ? Math.min(200, available - 240 - contentMinimum) : available - railWidth - contentMinimum;
    const next = Math.round(Math.max(Math.min(minimum, maximum), Math.min(requested, maximum)));
    navigation.style.setProperty(column === 'rail' ? '--deskpet-rail-width' : '--deskpet-panel-width', `${next}px`);
    return next;
  };

  const navigation: NavigationItem[] = [
    { id: 'chats', href: '#chats', label: t('聊天', 'Chats'), icon: <span className="deskpet-chat-home"><FaHouse aria-hidden />{unreadReplies.length > 0 && <span className="deskpet-chat-unread" aria-hidden />}</span> },
    { id: 'pet', href: '#pet', label: t('桌宠', 'Pet'), icon: currentCharacter ? <img src={currentCharacter.thumb} alt="" className="deskpet-toolbar-thumb" style={{ transform: `scale(${currentCharacter.thumbScale ?? 1})` }} /> : <PawPrint aria-hidden /> },
    { id: 'music', href: '#music', label: t('音乐', 'Music'), icon: <Music /> },
    { id: 'feedback', href: '#feedback', label: t('反馈', 'Feedback'), icon: <MessageSquarePlus />, badge: fbUnread || undefined },
    { id: 'donate', href: '#donate', label: t('赞助', 'Donate'), icon: <Heart className="heart-icon" /> },
    { id: 'account', href: '#account', label: t('账号菜单', 'Account menu'), icon: null },
  ].map(item => ({ ...item, active: item.id === activePanel }));
  const renderNavigationItem = ({ href, ...props }: NavigationLinkProps) => {
    if (href === '#account') return <ChatAccountMenu />;
    if (href === '#pet') return <CompactSelect
          open={activePanel === 'pet' && !!petPanelContainer}
          onOpenChange={open => { if (open) props.onClick?.(); setActivePanel(current => open ? 'pet' : current === 'pet' ? null : current); }}
          panelContainer={petPanelContainer}
          unstyledTrigger
          side="right"
          className="deskpet-character-select"
          triggerClassName={`${props.className} char-btn`}
          popupClassName="deskpet-character-menu settings-typography"
          ariaLabel={tr({ zh: '选择桌宠形象', en: 'Choose pet character' })}
          valueText={character === 'none' ? tr({ zh: '无', en: 'None' }) : currentCharacter ? tr(currentCharacter.label) : undefined}
          value={character}
          onChange={onSelectChar}
          label={props.children}
          items={[{ value: 'none', label: <span className="deskpet-character-option">
            <span className="deskpet-character-compact" aria-hidden><SquarePen size={13} /><AudioLines size={13} /><Settings size={13} /></span>
            <span>{tr({ zh: '无', en: 'None' })}</span>
            <span className="deskpet-character-status"><Check size={14} aria-hidden style={{ visibility: character === 'none' ? 'visible' : 'hidden' }} /></span>
          </span> }, ...characters.map(item => ({
            value: item.id,
            label: <span className="deskpet-character-option">
              <span className="deskpet-character-thumb" aria-hidden>
                <img src={item.thumb} alt="" style={{ transform: `scale(${item.thumbScale ?? 1})` }} />
              </span>
              <span>{tr(item.label)}</span>
              <span className="deskpet-character-status">
                <Check size={14} className="deskpet-character-check" aria-hidden
                  style={{ visibility: item.id === character ? 'visible' : 'hidden' }} />
                {catalogAdmin && <span className="deskpet-character-lock">{item.removed ? <Trash2 size={14} aria-label={tr({ zh: '已移除', en: 'Removed' })} /> : item.locked ? <Lock size={14} aria-label={tr({ zh: '仅管理员可见', en: 'Admin only' })} /> : <LockOpen size={14} aria-label={tr({ zh: '已开放', en: 'Public' })} />}</span>}
              </span>
            </span>,
          }))]}
          footer={close => (
            <>
              {catalogAdmin && currentCharacter && <div className="deskpet-character-admin">
                <button type="button" disabled={catalogDisabled || currentCharacter.removed} onClick={() => { void patchCharacter({ locked: !currentCharacter.locked }); }}>
                  {currentCharacter.locked ? <Lock size={14} /> : <LockOpen size={14} />}
                  {currentCharacter.locked ? tr({ zh: '开放', en: 'Make public' }) : tr({ zh: '锁定', en: 'Lock' })}
                </button>
                <button type="button" disabled={catalogDisabled || characters[0]?.id === character} onClick={() => moveCharacter(-1)} aria-label={tr({ zh: '向前移动', en: 'Move earlier' })}><ArrowLeft size={14} /></button>
                <button type="button" disabled={catalogDisabled || characters.at(-1)?.id === character} onClick={() => moveCharacter(1)} aria-label={tr({ zh: '向后移动', en: 'Move later' })}><ArrowRight size={14} /></button>
                <button type="button" disabled={catalogDisabled} onClick={() => { setNameZh(currentCharacter.label.zh); setNameEn(currentCharacter.label.en); setEditingName(true); }}><Pencil size={14} />{tr({ zh: '名称', en: 'Name' })}</button>
                <button type="button" disabled={catalogDisabled} onClick={() => { void patchCharacter({ removed: !currentCharacter.removed, locked: true }); }}>
                  {currentCharacter.removed ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                  {currentCharacter.removed ? tr({ zh: '恢复', en: 'Restore' }) : tr({ zh: '移除', en: 'Remove' })}
                </button>
                {editingName && <form onSubmit={event => { event.preventDefault(); void patchCharacter({ label: { zh: nameZh.trim(), en: nameEn.trim() } }).then(saved => { if (saved) setEditingName(false); }); }}>
                  <label>{tr({ zh: '中文名称', en: 'Chinese name' })}<input value={nameZh} maxLength={80} onChange={event => setNameZh(event.target.value)} /></label>
                  <label>{tr({ zh: '英文名称', en: 'English name' })}<input value={nameEn} maxLength={80} onChange={event => setNameEn(event.target.value)} /></label>
                  <button type="submit" disabled={catalogDisabled || !nameZh.trim() || !nameEn.trim()}>{tr({ zh: '保存', en: 'Save' })}</button>
                  <button type="button" onClick={() => setEditingName(false)}>{tr({ zh: '取消', en: 'Cancel' })}</button>
                </form>}
                {catalogError && <span className="deskpet-character-error" role="alert">{tr({ zh: '配置加载或保存失败，请重新打开后重试。', en: 'Could not load or save settings. Reopen and retry.' })}</span>}
              </div>}
              <div className="deskpet-character-gallery">
                <button type="button" className="compact-select-option" onClick={() => { close(); onOpenPetHome(); }}>
                  <span className="deskpet-character-option"><span className="deskpet-character-thumb" aria-hidden><Home size={18} /></span>
                    {tr({ zh: '领养 / 小窝', en: 'Adopt / My pet' })}</span>
                </button>
                {onNaturalSleep && <>
                  <button type="button" className="compact-select-option" onClick={() => onNaturalSleep('drowsy')}>
                    {tr({ zh: '渐进困倦（体验）', en: 'Try gradual drowsiness' })}
                  </button>
                  <button type="button" className="compact-select-option" onClick={() => onNaturalSleep('sleep')}>
                    {tr({ zh: '原地睡着', en: 'Sleep in place' })}
                  </button>
                </>}
              </div>
              <div className="deskpet-character-settings">
                <BoolToggle className="deskpet-character-setting"
                  value={petVisible} onChange={setPetVisible}
                  label={tr({ zh: '桌宠', en: 'Desk pet' })} />
                {character !== 'none' && <><div className="deskpet-character-setting">
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Maximize2 size={18} /></span>
                    <span>{tr({ zh: '大小', en: 'Size' })}</span>
                  </span>
                  <div className="deskpet-character-sizes" role="group" aria-label={tr({ zh: '桌宠大小', en: 'Pet size' })}>
                    {([
                      { value: 's', label: { zh: '小', en: 'S' } },
                      { value: 'm', label: { zh: '中', en: 'M' } },
                      { value: 'l', label: { zh: '大', en: 'L' } },
                    ] as const).map(item => (
                      <button key={item.value} type="button"
                        className={`compact-select-option deskpet-character-size${size === item.value ? ' active' : ''}`}
                        aria-pressed={size === item.value} onClick={() => onSelectSize(item.value)}>
                        {tr(item.label)}
                      </button>
                    ))}
                  </div>
                </div>
                <BoolToggle className="deskpet-character-setting deskpet-character-random"
                  value={randomMode} onChange={onToggleRandom}
                  ariaLabel={tr({ zh: '随机动画', en: 'Random animations' })}
                  label={<span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Shuffle size={18} /></span>
                    <span>{tr({ zh: '随机动画', en: 'Random animations' })}</span>
                  </span>} />
                <label className="deskpet-character-setting">
                  <span>{tr({ zh: '退场动作', en: 'Exit animation' })}</span>
                  <select value={exitStyle} onChange={event => onSelectExitStyle(event.target.value)}>
                    <option value="hop">{tr({ zh: '轻跳离开', en: 'Hop away' })}</option>
                    <option value="sleep">{tr({ zh: '盖被睡觉', en: 'Tuck in' })}</option>
                  </select>
                </label>
                <button type="button" className="compact-select-option deskpet-character-rest" onClick={onToggleRest}>
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden>
                      {resting ? <Sun size={18} /> : <Coffee size={18} />}
                    </span>
                    <span>{resting ? tr({ zh: '唤醒桌宠', en: 'Wake up' }) : tr({ zh: '休息一下', en: 'Take a nap' })}</span>
                  </span>
                </button></>}
              </div>
              {character !== 'none' && <div className="deskpet-character-gallery">
                <button type="button" className="compact-select-option" onClick={() => {
                  close();
                  window.location.assign(`${lang === 'zh' ? '/zh' : ''}/pets/gallery?pet=${character}`);
                }}>
                  <span className="deskpet-character-option">
                    <span className="deskpet-character-thumb" aria-hidden><Sparkles size={18} /></span>
                    <span>{tr({ zh: '图鉴', en: 'Gallery' })}</span>
                  </span>
                </button>
              </div>}
            </>
          )}
        />;
    return <button type="button" className={props.className}
      aria-label={props['aria-label']} title={props.title}
      aria-expanded={['#chats', '#music', '#feedback', '#donate'].includes(href) ? activePanel === href.slice(1) : undefined}
      onPointerEnter={href === '#donate' ? prefetchDonate : undefined}
      onFocus={href === '#donate' ? prefetchDonate : undefined}
      onClick={() => {
        props.onClick?.();
        if (href === '#chats') setActivePanel('chats');
        else if (href === '#donate') setDonateOpen(true);
        else if (href === '#feedback') setFeedbackOpen(true);
        else if (href === '#music') {
          setActivePanel(current => current === 'music' ? null : 'music');
        }
      }}>{props.children}</button>;
  };

  return (
    // This workspace closes explicitly; blank space is not a dismiss target.
    <div className="deskpet-search-workspace" data-mobile-panel={mobile && !!activePanel} ref={workspaceRef} style={open ? undefined : { display: 'none' }} inert={!open}>
      <style>{CSS}</style>
      <NavigationShell className="deskpet-navigation" iconOnly mobileLayout="rail" togglePlacement="header" collapseTarget="panel" onPanelOpen={() => setActivePanel('chats')} panelVisible={!!activePanel} mainClassName="deskpet-search-main" contentAs="div"
        items={navigation} renderLink={renderNavigationItem}
        labels={{ navigation: t('桌宠工具栏', 'Pet toolbar'), show: t('展开设置面板', 'Expand settings panel'), hide: t('收起设置面板', 'Collapse settings panel'), openMobile: t('设置', 'Settings'), closeMobile: t('关闭设置', 'Close settings') }}
        header={(_mobileToggle, toggle) => <div className="deskpet-navigation-header">
          <button className="deskpet-mobile-control" type="button" aria-label={t('返回首页', 'Go to home')} onClick={onClose}><ArrowLeft size={21}/></button>
          <span className="deskpet-mobile-control" data-navigation-panel-toggle><SidebarToggle collapsed={!activePanel} showLabel={t('打开聊天和设置', 'Open chats and settings')} hideLabel={t('关闭侧栏', 'Close sidebar')} onToggle={() => setActivePanel(current => current ? null : 'chats')} /></span>
          <ClearButton variant="standalone" className="deskpet-workspace-close"
            ariaLabel={t('关闭窗口', 'Close window')} onClick={onClose} />
          {isValidElement<ComponentProps<typeof SidebarToggle>>(toggle) ? cloneElement(toggle, {
            onToggle: () => {
              if (toggle.props.collapsed) boxRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.blur();
              toggle.props.onToggle();
            },
          }) : toggle}
          <button type="button" className="deskpet-conversation-title" onClick={() => {
            setActivePanel('chats');
            if (isValidElement<ComponentProps<typeof SidebarToggle>>(toggle) && toggle.props.collapsed) toggle.props.onToggle();
          }} aria-label={t('查看聊天列表', 'Show conversations')}><SquarePen size={18} /><span>{chatTitle(chats.activeId)}</span></button>
          <button className="deskpet-mobile-control" type="button" aria-label={t('新聊天', 'New chat')} onClick={newChat}><SquarePen size={21}/></button>
          <CubeRootLogo className="deskpet-home-logo" height={24} variant="mark" />
        </div>}>
        {activePanel && <section
          className="deskpet-detail-column af-nav-panel" data-site-surface="panel"
          aria-label={navigation.find(item => item.id === activePanel)?.label}
          ref={activePanel === 'pet' ? setPetPanelContainer : undefined}>
          {activePanel === 'chats' && <nav className="deskpet-chat-list settings-typography" aria-label={t('聊天列表', 'Conversations')}>
            <div className="deskpet-chat-heading"><strong>CubeRoot</strong>
              <CompactSelect unstyledTrigger triggerClassName="deskpet-chat-action deskpet-chat-bell" popupClassName="deskpet-reply-menu"
                ariaLabel={unreadReplies.length ? tr({ zh: `回答通知，${unreadReplies.length} 条未读`, en: `Reply notifications, ${unreadReplies.length} unread` }) : tr({ zh: '回答通知', en: 'Reply notifications' })}
                label={<><Bell size={18} aria-hidden />{unreadReplies.length > 0 && <span className="deskpet-chat-unread" aria-hidden />}</>}
                items={unreadReplies.map(chat => ({ value: chat.id, label: <span className="deskpet-reply-item"><span>{chatTitle(chat.id)}</span><small>{tr({ zh: '回答已完成', en: 'Answer ready' })}</small></span> }))}
                panelContent={unreadReplies.length ? undefined : <p className="deskpet-reply-empty">{tr({ zh: '暂无未读回答', en: 'No unread replies' })}</p>}
                onChange={selectChat} />
              <span className="sr-only" role="status">{unreadReplies.length > 0 ? tr({ zh: `有 ${unreadReplies.length} 个聊天的回答已完成`, en: `${unreadReplies.length} conversations have new replies` }) : ''}</span>
              <button type="button" className="deskpet-chat-action" aria-label={t('搜索聊天', 'Search conversations')} aria-expanded={chatSearchOpen} onClick={() => { setChatSearchOpen(value => !value); setChatSearch(''); }}><Search size={18}/></button>
            </div>
            {chatSearchOpen && <input className="deskpet-chat-search" value={chatSearch} onChange={event => setChatSearch(event.target.value)} placeholder={t('搜索聊天', 'Search conversations')} aria-label={t('搜索聊天', 'Search conversations')} />}
            <button type="button" className="af-nav-link" onClick={newChat}>
              <span className="af-nav-icon" aria-hidden="true"><SquarePen size={18}/></span><span>{t('新聊天', 'New chat')}</span>
            </button>
            {[true, false].map(pinned => {
              const items = chats.conversations.filter(chat => !!chat.pinned === pinned && (chat.snapshot.turns.length > 0 || chat.snapshot.draft.trim() || chat.snapshot.images.length > 0) && chatTitle(chat.id).toLocaleLowerCase().includes(chatSearch.trim().toLocaleLowerCase())).slice().reverse();
              return items.length ? <div key={String(pinned)}><div className="deskpet-chat-section">{pinned ? t('置顶', 'Pinned') : t('最近', 'Recent')}</div>{items.map(chat => <div className="deskpet-chat-row" key={chat.id}>
                {editingChat?.id === chat.id ? <form className="deskpet-chat-rename" onSubmit={event => {
                  event.preventDefault();
                  if (!editingChat.title.trim()) return;
                  assistantConversations.rename(owner, chat.id, editingChat.title);
                  setEditingChat(null);
                }}>
                  <div className="deskpet-chat-name-field">
                    <input autoFocus maxLength={120} value={editingChat.title} aria-label={tr({ zh: '聊天名称', en: 'Conversation name' })}
                      onFocus={event => event.currentTarget.select()} onChange={event => setEditingChat({ id: chat.id, title: event.target.value })} />
                    {editingChat.title && <ClearButton onClick={() => setEditingChat({ id: chat.id, title: '' })} />}
                  </div>
                  <Tooltip content={tr({ zh: '保存名称', en: 'Save name' })}>{tip => <button {...tip} type="submit" className="deskpet-chat-action" disabled={!editingChat.title.trim()} aria-label={tr({ zh: '保存名称', en: 'Save name' })}><Check size={18} aria-hidden /></button>}</Tooltip>
                  <Tooltip content={tr({ zh: '取消重命名', en: 'Cancel rename' })}>{tip => <button {...tip} type="button" className="deskpet-chat-action" aria-label={tr({ zh: '取消重命名', en: 'Cancel rename' })} onClick={() => setEditingChat(null)}><X size={18} aria-hidden /></button>}</Tooltip>
                </form> : <>
                <button type="button" className="af-nav-link" aria-current={chat.id === chats.activeId ? 'page' : undefined} onClick={() => selectChat(chat.id)}><span className="af-nav-icon" aria-hidden="true"><MessageSquare size={18} /></span><span>{chatTitle(chat.id)}</span></button>
                <div className="deskpet-chat-row-actions">
                <CompactSelect unstyledTrigger triggerClassName="deskpet-chat-action" popupClassName="deskpet-chat-menu"
                  ariaLabel={tr({ zh: '聊天更多操作', en: 'More conversation actions' })} label={<Ellipsis size={18} aria-hidden />}
                  items={[{ value: 'pin', label: <><Pin size={16} aria-hidden />{chat.pinned ? tr({ zh: '取消置顶', en: 'Unpin conversation' }) : tr({ zh: '置顶聊天', en: 'Pin conversation' })}</> }]}
                  onChange={() => assistantConversations.setPinned(owner, chat.id, !chat.pinned)} />
                <Tooltip content={tr({ zh: '重命名聊天', en: 'Rename conversation' })}>{tip => <button {...tip} type="button" className="deskpet-chat-action" aria-label={tr({ zh: '重命名聊天', en: 'Rename conversation' })} onClick={() => setEditingChat({ id: chat.id, title: chatTitle(chat.id) })}><SquarePen size={18} aria-hidden /></button>}</Tooltip>
                </div>
                </>}
              </div>)}</div> : null;
            })}
          </nav>}
          {activePanel === 'music' && <FloatingMetronome embedded lang={lang} onClose={() => setActivePanel(null)} />}
          {donateOpen && <DonateModal embedded lang={lang} onClose={() => setDonateOpen(false)} />}
          {feedbackOpen && <FeedbackModal embedded lang={lang} onClose={() => setFeedbackOpen(false)} />}
        </section>}
        <ResizeDivider className="deskpet-divider deskpet-divider--rail" label={t('调整图标栏宽度', 'Resize icon rail')}
          getSize={handle => handle.closest('.deskpet-navigation')?.querySelector('.af-nav-sidebar')?.getBoundingClientRect().width ?? 58}
          onResize={(handle, requested) => resizeColumn(handle, requested, 'rail')} />
        {activePanel && <ResizeDivider className="deskpet-divider deskpet-divider--panel" label={t('调整侧栏宽度', 'Resize side panel')}
          getSize={handle => handle.closest('.deskpet-navigation')?.querySelector('.af-nav-panel')?.getBoundingClientRect().width ?? 400}
          onResize={(handle, requested) => resizeColumn(handle, requested, 'panel')} />}
        <div className="deskpet-search-box" ref={boxRef} inert={mobile && !!activePanel}>
          {chats.conversations.map(chat => <AssistantConversationView key={`${owner}:${chat.id}`} owner={owner} conversation={chat} active={open && chat.id === chats.activeId && !(mobile && !!activePanel)} cards={searchCards} lang={lang} />)}
        </div>
      </NavigationShell>
    </div>
  );
}
