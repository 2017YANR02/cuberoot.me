'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo2,
  Folder,
  FolderPlus,
  HardDrive,
  Link2,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Share2,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  DRIVE_CHUNK_BYTES,
  isDrivePreviewableMime,
  type DriveNode,
  type DriveSnapshot,
} from '@cuberoot/shared/drive';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { ClearButton } from '@/components/ClearButton';
import HeaderToggles from '@/components/HeaderToggles';
import PillToggle from '@/components/PillToggle/PillToggle';
import { SearchInput } from '@/components/SearchInput';
import { useCopy } from '@/hooks/useCopy';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { useLang } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { useAuthStore } from '@/lib/auth-store';
import { searchFriendUsers, type FriendSearchUser } from '@/lib/friends-api';
import {
  addDriveMember,
  cancelDriveUpload,
  createDriveAccess,
  createDriveFolder,
  createDriveShare,
  createDriveUpload,
  deleteDriveNode,
  downloadDriveFile,
  fetchDrive,
  fetchDriveMembers,
  removeDriveMember,
  revokeDriveShare,
  restoreDriveNode,
  trashDriveNode,
  updateDriveNode,
  uploadDriveChunk,
  type DriveMember,
} from '@/lib/drive-api';
import './drive.css';

type DriveView = 'files' | 'trash';
type UploadState = 'queued' | 'uploading' | 'paused' | 'done' | 'error';
type DownloadState = 'downloading' | 'pausing' | 'paused' | 'done' | 'error';

interface UploadTask {
  id: string;
  file: File;
  parentId: string | null;
  uploadId: string | null;
  offset: number;
  inFlightBytes: number;
  speedBytesPerSecond: number | null;
  state: UploadState;
  error: string | null;
}

interface DownloadTask {
  id: string;
  node: DriveNode;
  handle: DriveSaveFileHandle;
  downloadedBytes: number;
  speedBytesPerSecond: number | null;
  state: DownloadState;
  error: string | null;
}

interface DriveSaveFileHandle {
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

type DriveWindow = Window & {
  showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<DriveSaveFileHandle>;
};

interface PreviewState {
  node: DriveNode;
  url: string;
}

interface DriveShareDialogProps {
  node: DriveNode;
  url: string | null;
  busy: boolean;
  onVisibilityChange: (shared: boolean) => void;
  onClose: () => void;
}

function DriveShareDialog({ node, url, busy, onVisibilityChange, onClose }: DriveShareDialogProps) {
  const t = useT();
  const { copied, copy } = useCopy();
  useModalDismiss(onClose, busy);

  return (
    <div
      className="drive-preview-backdrop"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <div className="drive-preview drive-share-dialog" role="dialog" aria-modal="true" aria-label={t('分享下载链接', 'Share download link')}>
        <div className="drive-preview-head">
          <strong>{node.name}</strong>
          <ClearButton variant="standalone" ariaLabel={t('关闭分享设置', 'Close sharing settings')} onClick={onClose} />
        </div>
        <div className="drive-share-body">
          <div className="drive-share-mode">
            <span>{t('访问权限', 'Access')}</span>
            <PillToggle
              value={node.shared}
              onChange={onVisibilityChange}
              onLabel={t('任何获得链接的人', 'Anyone with the link')}
              offLabel={t('仅自己', 'Restricted')}
              ariaLabel={t('文件分享权限', 'File sharing access')}
              disabled={busy}
            />
          </div>
          <p>
            {node.shared
              ? t('无需登录即可下载，也支持断点续传。链接不会出现在公开目录或搜索页。', 'No sign-in is required, and resumable downloads are supported. The link is not listed in a public directory or search page.')
              : t('只有你自己可以访问此文件。', 'Only you can access this file.')}
          </p>
          {node.shared && url && (
            <div className="drive-share-link">
              <input className="drive-text-control" value={url} readOnly aria-label={t('公开下载链接', 'Public download link')} />
              <button type="button" className="drive-control" disabled={busy} onClick={() => copy(url)}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? t('已复制', 'Copied') : t('复制链接', 'Copy link')}
              </button>
            </div>
          )}
          {node.shared && !url && <div className="drive-loading drive-share-loading"><Loader2 className="drive-spin" />{t('正在生成链接…', 'Preparing link…')}</div>}
          <small>{t('停止分享后旧链接立即失效；重新公开会生成新链接。移入回收站也会停止分享。', 'Stopping sharing invalidates the old link immediately. Enabling it again creates a new link. Moving the file to Trash also stops sharing.')}</small>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function FileKindIcon({ node }: { node: DriveNode }) {
  if (node.kind === 'folder') return <Folder aria-hidden="true" />;
  const mime = node.mimeType ?? '';
  if (mime.startsWith('image/')) return <FileImage aria-hidden="true" />;
  if (mime.startsWith('video/')) return <FileVideo2 aria-hidden="true" />;
  if (mime.startsWith('audio/')) return <FileAudio aria-hidden="true" />;
  if (mime === 'application/pdf' || mime.startsWith('text/')) return <FileText aria-hidden="true" />;
  if (/zip|rar|7z|tar|gzip/.test(mime)) return <FileArchive aria-hidden="true" />;
  return <File aria-hidden="true" />;
}

function DrivePageContent() {
  const t = useT();
  const lang = useLang();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [mounted, setMounted] = useState(false);
  const [folderId] = useQueryState('folder', parseAsString);
  const [view] = useQueryState(
    'view',
    parseAsStringEnum<DriveView>(['files', 'trash']).withDefault('files').withOptions({ history: 'push' }),
  );
  const [previewId, setPreviewId] = useQueryState(
    'preview',
    parseAsString.withOptions({ history: 'push', scroll: false }),
  );
  const [snapshot, setSnapshot] = useState<DriveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<DriveMember[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<FriendSearchUser[]>([]);
  const [memberBusy, setMemberBusy] = useState<number | null>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [shareNode, setShareNode] = useState<DriveNode | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef(tasks);
  const downloadTasksRef = useRef(downloadTasks);
  const activeRef = useRef(new Set<string>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const downloadControllersRef = useRef(new Map<string, AbortController>());
  const discardedDownloadsRef = useRef(new Set<string>());

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { downloadTasksRef.current = downloadTasks; }, [downloadTasks]);

  const updateTask = useCallback((id: string, changes: Partial<UploadTask>) => {
    setTasks((current) => {
      const next = current.map((item) => item.id === id ? { ...item, ...changes } : item);
      tasksRef.current = next;
      return next;
    });
  }, []);

  const updateDownloadTask = useCallback((id: string, changes: Partial<DownloadTask>) => {
    setDownloadTasks((current) => {
      const next = current.map((item) => item.id === id ? { ...item, ...changes } : item);
      downloadTasksRef.current = next;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchDrive(view === 'trash' ? null : folderId, view === 'trash'));
    } catch {
      setError(t('网盘加载失败，请稍后重试。', 'Could not load Drive. Try again later.'));
    } finally {
      setLoading(false);
    }
  }, [folderId, t, user, view]);

  useEffect(() => {
    if (mounted && user) void load();
  }, [load, mounted, user]);

  const loadMembers = useCallback(async () => {
    try {
      setMembers(await fetchDriveMembers());
    } catch {
      setError(t('成员列表加载失败。', 'Could not load the member list.'));
    }
  }, [t]);

  useEffect(() => {
    if (!membersOpen || !snapshot?.isAdmin) return;
    void loadMembers();
  }, [loadMembers, membersOpen, snapshot?.isAdmin]);

  useEffect(() => {
    if (!membersOpen || !snapshot?.isAdmin) return;
    const query = memberQuery.trim();
    if (query.length < 2 && !/^\d+$/.test(query)) {
      setMemberResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchFriendUsers(query)
        .then((results) => {
          if (!cancelled) setMemberResults(results.filter((result) => !members.some((member) => member.userId === result.userId)));
        })
        .catch(() => {
          if (!cancelled) setError(t('成员搜索失败。', 'Member search failed.'));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [memberQuery, members, membersOpen, snapshot?.isAdmin, t]);

  const runUpload = useCallback(async (taskId: string) => {
    let current = tasksRef.current.find((task) => task.id === taskId);
    if (!current) return;
    const controller = new AbortController();
    controllersRef.current.set(taskId, controller);
    updateTask(taskId, {
      state: 'uploading',
      error: null,
      inFlightBytes: 0,
      speedBytesPerSecond: null,
    });
    try {
      const session = await createDriveUpload(current.file, current.parentId);
      current = tasksRef.current.find((task) => task.id === taskId);
      if (!current) {
        await cancelDriveUpload(session.id).catch(() => {});
        return;
      }
      updateTask(taskId, {
        uploadId: session.id,
        offset: session.receivedBytes,
        inFlightBytes: 0,
      });
      let offset = session.receivedBytes;
      const speedSamples = [{ at: performance.now(), bytes: offset }];
      let lastProgressRender = 0;
      while (offset < current.file.size) {
        const latest = tasksRef.current.find((task) => task.id === taskId);
        if (!latest || latest.state !== 'uploading') return;
        const end = Math.min(offset + DRIVE_CHUNK_BYTES, current.file.size);
        const chunkOffset = offset;
        const chunk = current.file.slice(chunkOffset, end);
        const result = await uploadDriveChunk(
          session.id,
          chunkOffset,
          chunk,
          controller.signal,
          (uploadedBytes) => {
            const now = performance.now();
            const totalUploaded = chunkOffset + uploadedBytes;
            speedSamples.push({ at: now, bytes: totalUploaded });
            const cutoff = now - 3_000;
            while (speedSamples.length > 2 && speedSamples[1].at < cutoff) speedSamples.shift();
            const oldest = speedSamples[0];
            const elapsedSeconds = (now - oldest.at) / 1_000;
            const speedBytesPerSecond = elapsedSeconds > 0
              ? Math.max(0, (totalUploaded - oldest.bytes) / elapsedSeconds)
              : null;
            if (now - lastProgressRender >= 100 || uploadedBytes === chunk.size) {
              lastProgressRender = now;
              updateTask(taskId, { inFlightBytes: uploadedBytes, speedBytesPerSecond });
            }
          },
        );
        offset = result.offset;
        updateTask(taskId, { offset, inFlightBytes: 0 });
        if (result.complete) break;
      }
      updateTask(taskId, {
        state: 'done',
        offset: current.file.size,
        inFlightBytes: 0,
        speedBytesPerSecond: null,
      });
      await load();
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') {
        updateTask(taskId, {
          state: 'error',
          inFlightBytes: 0,
          speedBytesPerSecond: null,
          error: t('上传中断，可点继续或重新选择同一文件续传。', 'Upload interrupted. Continue here or reselect the same file to resume.'),
        });
      } else {
        updateTask(taskId, { inFlightBytes: 0, speedBytesPerSecond: null });
      }
    } finally {
      controllersRef.current.delete(taskId);
      activeRef.current.delete(taskId);
      setTasks((currentTasks) => [...currentTasks]);
    }
  }, [load, t, updateTask]);

  useEffect(() => {
    const available = Math.max(0, 2 - activeRef.current.size);
    if (!available) return;
    const queued = tasks.filter((task) => task.state === 'queued' && !activeRef.current.has(task.id)).slice(0, available);
    queued.forEach((task) => {
      activeRef.current.add(task.id);
      void runUpload(task.id);
    });
  }, [runUpload, tasks]);

  const enqueueFiles = useCallback((files: FileList | File[]) => {
    const additions = Array.from(files)
      .filter((file) => file.size > 0)
      .map<UploadTask>((file) => ({
        id: crypto.randomUUID(),
        file,
        parentId: view === 'trash' ? null : folderId,
        uploadId: null,
        offset: 0,
        inFlightBytes: 0,
        speedBytesPerSecond: null,
        state: 'queued',
        error: null,
      }));
    if (!additions.length) {
      setError(t('不能上传空文件。', 'Empty files cannot be uploaded.'));
      return;
    }
    setTasks((current) => [...current, ...additions]);
  }, [folderId, t, view]);

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) enqueueFiles(event.target.files);
    event.target.value = '';
  };

  const pauseTask = (task: UploadTask) => {
    updateTask(task.id, { state: 'paused' });
    controllersRef.current.get(task.id)?.abort();
  };

  const resumeTask = (task: UploadTask) => updateTask(task.id, { state: 'queued', error: null });

  const removeTask = async (task: UploadTask) => {
    controllersRef.current.get(task.id)?.abort();
    setTasks((current) => {
      const next = current.filter((item) => item.id !== task.id);
      tasksRef.current = next;
      return next;
    });
    if (task.uploadId && task.state !== 'done') await cancelDriveUpload(task.uploadId).catch(() => {});
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setError(null);
    try {
      await createDriveFolder(folderId, name);
      setNewFolderName('');
      setNewFolderOpen(false);
      await load();
    } catch {
      setError(t('新建文件夹失败，名称可能已存在或不合法。', 'Could not create the folder. The name may already exist or be invalid.'));
    }
  };

  const renameNode = async (node: DriveNode) => {
    const name = window.prompt(t('输入新名称', 'Enter a new name'), node.name)?.trim();
    if (!name || name === node.name) return;
    try {
      await updateDriveNode(node.id, { name });
      await load();
    } catch {
      setError(t('重命名失败，名称可能已存在或不合法。', 'Could not rename this item. The name may already exist or be invalid.'));
    }
  };

  const replaceNode = (node: DriveNode) => {
    setSnapshot((current) => current ? {
      ...current,
      nodes: current.nodes.map((item) => item.id === node.id ? node : item),
    } : current);
    setShareNode((current) => current?.id === node.id ? node : current);
  };

  const openShare = async (node: DriveNode) => {
    setShareNode(node);
    setShareUrl(null);
    if (!node.shared) return;
    setShareBusy(true);
    try {
      const share = await createDriveShare(node.id);
      setShareUrl(share.url);
    } catch {
      setError(t('分享链接加载失败。', 'Could not load the share link.'));
    } finally {
      setShareBusy(false);
    }
  };

  const changeShareVisibility = async (shared: boolean) => {
    if (!shareNode || shareBusy || shareNode.shared === shared) return;
    setShareBusy(true);
    try {
      if (shared) {
        const share = await createDriveShare(shareNode.id);
        replaceNode({ ...shareNode, shared: true });
        setShareUrl(share.url);
      } else {
        await revokeDriveShare(shareNode.id);
        replaceNode({ ...shareNode, shared: false });
        setShareUrl(null);
      }
    } catch {
      setError(t('分享设置保存失败。', 'Could not save the sharing setting.'));
    } finally {
      setShareBusy(false);
    }
  };

  const moveToTrash = async (node: DriveNode) => {
    if ((node.shared || node.kind === 'folder') && !window.confirm(t(
      `将“${node.name}”移入回收站？其中的公开下载链接会立即失效。`,
      `Move “${node.name}” to Trash? Public download links inside it will stop working immediately.`,
    ))) return;
    try {
      await trashDriveNode(node.id);
      if (shareNode?.id === node.id) {
        setShareNode(null);
        setShareUrl(null);
      }
      await load();
    } catch {
      setError(t('移入回收站失败；如果其中有上传任务，请先取消上传。', 'Could not move this item to Trash. Cancel any uploads inside it first.'));
    }
  };

  const restoreNode = async (node: DriveNode) => {
    try {
      await restoreDriveNode(node.id);
      await load();
    } catch {
      setError(t('恢复失败，原位置可能已有同名项目。', 'Could not restore this item. Its original location may contain an item with the same name.'));
    }
  };

  const permanentlyDelete = async (node: DriveNode) => {
    if (!window.confirm(t(`永久删除“${node.name}”？此操作无法撤销。`, `Permanently delete “${node.name}”? This cannot be undone.`))) return;
    try {
      await deleteDriveNode(node.id);
      await load();
    } catch {
      setError(t('永久删除失败。', 'Could not permanently delete this item.'));
    }
  };

  const runDownload = useCallback(async (taskId: string) => {
    if (downloadControllersRef.current.has(taskId)) return;
    const current = downloadTasksRef.current.find((task) => task.id === taskId);
    if (!current || current.state === 'done') return;
    const controller = new AbortController();
    downloadControllersRef.current.set(taskId, controller);
    discardedDownloadsRef.current.delete(taskId);
    updateDownloadTask(taskId, { state: 'downloading', speedBytesPerSecond: null, error: null });

    const offset = current.downloadedBytes;
    const speedSamples = [{ at: performance.now(), bytes: offset }];
    let lastProgressRender = 0;
    let latestDownloadedBytes = offset;
    try {
      const access = await createDriveAccess(current.node.id, false);
      const writable = await current.handle.createWritable({ keepExistingData: offset > 0 });
      if (offset > 0) await writable.seek(offset);
      await downloadDriveFile(access.url, current.node.sizeBytes, writable, {
        offset,
        signal: controller.signal,
        keepPartialOnError: () => !discardedDownloadsRef.current.has(taskId),
        onProgress: (downloadedBytes) => {
          latestDownloadedBytes = downloadedBytes;
          const now = performance.now();
          speedSamples.push({ at: now, bytes: downloadedBytes });
          const cutoff = now - 3_000;
          while (speedSamples.length > 2 && speedSamples[1].at < cutoff) speedSamples.shift();
          const oldest = speedSamples[0];
          const elapsedSeconds = (now - oldest.at) / 1_000;
          const speedBytesPerSecond = elapsedSeconds > 0
            ? Math.max(0, (downloadedBytes - oldest.bytes) / elapsedSeconds)
            : null;
          if (now - lastProgressRender >= 100 || downloadedBytes === current.node.sizeBytes) {
            lastProgressRender = now;
            updateDownloadTask(taskId, { downloadedBytes, speedBytesPerSecond });
          }
        },
      });
      updateDownloadTask(taskId, {
        downloadedBytes: current.node.sizeBytes,
        speedBytesPerSecond: null,
        state: 'done',
      });
    } catch (cause) {
      if (!discardedDownloadsRef.current.has(taskId)) {
        updateDownloadTask(taskId, {
          downloadedBytes: latestDownloadedBytes,
          speedBytesPerSecond: null,
          state: (cause as Error).name === 'AbortError' ? 'paused' : 'error',
          error: (cause as Error).name === 'AbortError'
            ? null
            : t('下载中断，可从当前进度继续。', 'Download interrupted. You can continue from the current progress.'),
        });
      }
    } finally {
      downloadControllersRef.current.delete(taskId);
      discardedDownloadsRef.current.delete(taskId);
    }
  }, [t, updateDownloadTask]);

  const downloadNode = async (node: DriveNode) => {
    const picker = (window as DriveWindow).showSaveFilePicker;
    if (!picker) {
      try {
        const access = await createDriveAccess(node.id, false);
        const anchor = document.createElement('a');
        anchor.href = access.url;
        anchor.download = node.name;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } catch {
        setError(t('下载链接生成失败。', 'Could not prepare the download.'));
      }
      return;
    }

    let handle: DriveSaveFileHandle;
    try {
      handle = await picker.call(window, { suggestedName: node.name });
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') {
        setError(t('无法打开文件保存位置。', 'Could not open a file save location.'));
      }
      return;
    }

    const taskId = crypto.randomUUID();
    const task: DownloadTask = {
      id: taskId,
      node,
      handle,
      downloadedBytes: 0,
      speedBytesPerSecond: null,
      state: 'downloading',
      error: null,
    };
    setDownloadTasks((current) => {
      const next = [...current, task];
      downloadTasksRef.current = next;
      return next;
    });
    void runDownload(taskId);
  };

  const pauseDownloadTask = (task: DownloadTask) => {
    updateDownloadTask(task.id, { state: 'pausing', speedBytesPerSecond: null });
    downloadControllersRef.current.get(task.id)?.abort();
  };

  const resumeDownloadTask = (task: DownloadTask) => void runDownload(task.id);

  const removeDownloadTask = (task: DownloadTask) => {
    discardedDownloadsRef.current.add(task.id);
    downloadControllersRef.current.get(task.id)?.abort();
    setDownloadTasks((current) => {
      const next = current.filter((item) => item.id !== task.id);
      downloadTasksRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    setPreview(null);
    if (!previewId || !snapshot) return;
    const node = snapshot.nodes.find((item) => item.id === previewId && item.kind === 'file');
    if (!node) {
      void setPreviewId(null);
      return;
    }
    let cancelled = false;
    createDriveAccess(node.id, true)
      .then((access) => {
        if (!cancelled) setPreview({ node, url: access.url });
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('预览链接生成失败。', 'Could not prepare the preview.'));
          void setPreviewId(null);
        }
      });
    return () => { cancelled = true; };
  }, [previewId, setPreviewId, snapshot, t]);

  const addMember = async (candidate: FriendSearchUser) => {
    setMemberBusy(candidate.userId);
    try {
      await addDriveMember(candidate.userId);
      setMemberQuery('');
      setMemberResults([]);
      await loadMembers();
    } catch {
      setError(t('添加成员失败。', 'Could not add this member.'));
    } finally {
      setMemberBusy(null);
    }
  };

  const revokeMember = async (member: DriveMember) => {
    setMemberBusy(member.userId);
    try {
      await removeDriveMember(member.userId);
      await loadMembers();
    } catch {
      setError(t('移除成员失败。', 'Could not remove this member.'));
    } finally {
      setMemberBusy(null);
    }
  };

  const quota = snapshot?.quota;
  const occupied = quota ? quota.usedBytes + quota.reservedBytes : 0;
  const quotaPercent = quota ? Math.min(100, occupied / quota.limitBytes * 100) : 0;
  const visibleRemoteUploads = snapshot?.uploads.filter((upload) => !tasks.some((task) => task.uploadId === upload.id)) ?? [];
  const breadcrumbs = useMemo(() => snapshot?.breadcrumbs ?? [], [snapshot?.breadcrumbs]);

  if (!mounted) return <main className="drive-page"><div className="drive-loading"><Loader2 className="drive-spin" />{t('正在加载…', 'Loading…')}</div></main>;

  if (!user) {
    return (
      <main className="drive-page">
        <div className="drive-topbar"><BackHome /><HeaderToggles /></div>
        <section className="drive-gate">
          <HardDrive aria-hidden="true" />
          <h1>{t('CubeRoot 网盘', 'CubeRoot Drive')}</h1>
          <p>{t('这是供公司和受邀朋友使用的私有网盘。登录后才能访问。', 'This private Drive is for the company and invited friends. Sign in to access it.')}</p>
          <button type="button" className="drive-primary" onClick={login}>{t('登录', 'Sign in')}</button>
        </section>
      </main>
    );
  }

  if (!loading && snapshot && !snapshot.allowed) {
    return (
      <main className="drive-page">
        <div className="drive-topbar"><BackHome /><HeaderToggles /></div>
        <section className="drive-gate">
          <HardDrive aria-hidden="true" />
          <h1>{t('CubeRoot 网盘', 'CubeRoot Drive')}</h1>
          <p>{t('当前账号还没有访问权限，请联系管理员加入白名单。', 'This account does not have access yet. Ask an administrator to add it.')}</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`drive-page${dragging ? ' is-dragging' : ''}`}
      onDragEnter={(event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
      onDragLeave={(event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setDragging(false);
      }}
      onDrop={(event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDragging(false);
        if (view === 'files' && event.dataTransfer.files.length) enqueueFiles(event.dataTransfer.files);
      }}
    >
      <div className="drive-topbar"><BackHome /><HeaderToggles /></div>

      <header className="drive-header">
        <div>
          <div className="drive-title-line"><HardDrive aria-hidden="true" /><h1>{t('网盘', 'Drive')}</h1></div>
          <p>{t('20GB 共享容量，文件默认私有；支持断点传输和可撤销的公开下载链接。', '20 GB shared capacity with private-by-default files, resumable transfers, and revocable public download links.')}</p>
        </div>
        {quota && (
          <div className="drive-quota" aria-label={t('存储空间用量', 'Storage usage')}>
            <div><span>{formatBytes(occupied)} / {formatBytes(quota.limitBytes)}</span><span>{quotaPercent.toFixed(1)}%</span></div>
            <div className="drive-quota-track"><span style={{ width: `${quotaPercent}%` }} /></div>
            {quota.reservedBytes > 0 && <small>{t('上传中预留', 'Reserved for uploads')} {formatBytes(quota.reservedBytes)}</small>}
          </div>
        )}
      </header>

      <nav className="drive-view-tabs" aria-label={t('网盘视图', 'Drive views')}>
        <AppLink href="/drive" className={view === 'files' ? 'is-active' : ''} prefetch={false}>{t('文件', 'Files')}</AppLink>
        <AppLink href="/drive?view=trash" className={view === 'trash' ? 'is-active' : ''} prefetch={false}><Trash2 aria-hidden="true" />{t('回收站', 'Trash')}</AppLink>
      </nav>

      {view === 'files' && (
        <div className="drive-toolbar">
          <input ref={inputRef} className="drive-file-input" type="file" multiple onChange={onFilesSelected} />
          <button type="button" className="drive-control drive-primary" onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />{t('上传文件', 'Upload files')}</button>
          <button type="button" className="drive-control" onClick={() => setNewFolderOpen(true)}><FolderPlus aria-hidden="true" />{t('新建文件夹', 'New folder')}</button>
          {snapshot?.isAdmin && <button type="button" className="drive-control" onClick={() => setMembersOpen((open) => !open)}><Users aria-hidden="true" />{t('成员', 'Members')}</button>}
        </div>
      )}

      {newFolderOpen && view === 'files' && (
        <form className="drive-inline-form" onSubmit={(event) => { event.preventDefault(); void createFolder(); }}>
          <input className="drive-text-control drive-inline-control" autoFocus value={newFolderName} maxLength={255} onChange={(event) => setNewFolderName(event.target.value)} placeholder={t('文件夹名称', 'Folder name')} aria-label={t('文件夹名称', 'Folder name')} />
          <button type="submit" className="drive-control drive-primary" disabled={!newFolderName.trim()}>{t('创建', 'Create')}</button>
          <ClearButton variant="standalone" ariaLabel={t('取消新建文件夹', 'Cancel new folder')} onClick={() => { setNewFolderOpen(false); setNewFolderName(''); }} />
        </form>
      )}

      {membersOpen && snapshot?.isAdmin && (
        <section className="drive-members" aria-labelledby="drive-members-title">
          <div className="drive-section-title"><h2 id="drive-members-title">{t('访问成员', 'Access members')}</h2><span>{members.length}</span></div>
          <SearchInput value={memberQuery} onChange={setMemberQuery} placeholder={t('搜索账号、姓名或 WCA ID', 'Search account, name, or WCA ID')} className="drive-member-search" inputClassName="drive-text-control" />
          {memberResults.length > 0 && (
            <div className="drive-member-results">
              {memberResults.map((candidate) => (
                <div key={candidate.userId}><span><strong>{candidate.name}</strong>{candidate.wcaId && <small>{candidate.wcaId}</small>}</span><button type="button" className="drive-control" onClick={() => void addMember(candidate)} disabled={memberBusy === candidate.userId}><UserPlus aria-hidden="true" />{t('加入', 'Add')}</button></div>
              ))}
            </div>
          )}
          <div className="drive-member-list">
            {members.map((member) => (
              <div key={member.userId}><span><strong>{member.name}</strong>{member.wcaId && <small>{member.wcaId}</small>}</span><button type="button" className="drive-icon-action drive-danger" onClick={() => void revokeMember(member)} disabled={memberBusy === member.userId} aria-label={t(`移除 ${member.name}`, `Remove ${member.name}`)}><UserMinus aria-hidden="true" /></button></div>
            ))}
          </div>
        </section>
      )}

      {error && <div className="drive-error" role="alert"><span>{error}</span><ClearButton variant="standalone" ariaLabel={t('关闭错误提示', 'Dismiss error')} onClick={() => setError(null)} /></div>}

      {(tasks.length > 0 || visibleRemoteUploads.length > 0) && (
        <section className="drive-uploads" aria-labelledby="drive-uploads-title">
          <div className="drive-section-title"><h2 id="drive-uploads-title">{t('上传任务', 'Uploads')}</h2><span>{tasks.length + visibleRemoteUploads.length}</span></div>
          {tasks.map((task) => {
            const displayedBytes = Math.min(task.file.size, task.offset + task.inFlightBytes);
            const progress = task.file.size ? Math.min(100, displayedBytes / task.file.size * 100) : 0;
            return (
              <div className="drive-upload-row" key={task.id}>
                <div className="drive-upload-main">
                  <strong>{task.file.name}</strong>
                  <span>
                    {formatBytes(displayedBytes)} / {formatBytes(task.file.size)}{' '}
                    {task.state === 'done' ? t('已完成', 'Complete') : `${progress.toFixed(0)}%`}
                    {task.state === 'uploading' && <> {' '}{task.speedBytesPerSecond == null ? t('测速中…', 'Measuring…') : `${formatBytes(task.speedBytesPerSecond)}/s`}</>}
                  </span>
                  <div className="drive-upload-track"><span style={{ width: `${progress}%` }} /></div>
                  {task.error && <small className="drive-danger-text">{task.error}</small>}
                </div>
                <div className="drive-upload-actions">
                  {(task.state === 'uploading' || task.state === 'queued') && <button type="button" className="drive-icon-action" onClick={() => pauseTask(task)} aria-label={t(`暂停 ${task.file.name}`, `Pause ${task.file.name}`)}><Pause aria-hidden="true" /></button>}
                  {(task.state === 'paused' || task.state === 'error') && <button type="button" className="drive-icon-action" onClick={() => resumeTask(task)} aria-label={t(`继续 ${task.file.name}`, `Resume ${task.file.name}`)}><Play aria-hidden="true" /></button>}
                  <ClearButton variant="standalone" ariaLabel={task.state === 'done' ? t('移除已完成任务', 'Dismiss completed upload') : t(`取消 ${task.file.name}`, `Cancel ${task.file.name}`)} onClick={() => void removeTask(task)} />
                </div>
              </div>
            );
          })}
          {visibleRemoteUploads.map((upload) => (
            <div className="drive-upload-row" key={upload.id}>
              <div className="drive-upload-main"><strong>{upload.name}</strong><span>{formatBytes(upload.receivedBytes)} / {formatBytes(upload.expectedBytes)}</span><div className="drive-upload-track"><span style={{ width: `${Math.min(100, upload.receivedBytes / upload.expectedBytes * 100)}%` }} /></div><small>{t('重新选择这个文件即可从当前进度继续。', 'Reselect this file to continue from the current offset.')}</small></div>
              <ClearButton variant="standalone" ariaLabel={t(`取消 ${upload.name}`, `Cancel ${upload.name}`)} onClick={() => void cancelDriveUpload(upload.id).then(load).catch(() => setError(t('取消上传失败。', 'Could not cancel the upload.')))} />
            </div>
          ))}
        </section>
      )}

      {downloadTasks.length > 0 && (
        <section className="drive-downloads" aria-labelledby="drive-downloads-title">
          <div className="drive-section-title"><h2 id="drive-downloads-title">{t('下载任务', 'Downloads')}</h2><span>{downloadTasks.length}</span></div>
          {downloadTasks.map((task) => {
            const progress = task.node.sizeBytes ? Math.min(100, task.downloadedBytes / task.node.sizeBytes * 100) : 100;
            return (
              <div className="drive-upload-row" key={task.id}>
                <div className="drive-upload-main">
                  <strong>{task.node.name}</strong>
                  <span>
                    {formatBytes(task.downloadedBytes)} / {formatBytes(task.node.sizeBytes)}{' '}
                    {task.state === 'done' ? t('已完成', 'Complete') : `${progress.toFixed(0)}%`}
                    {task.state === 'downloading' && <> {' '}{task.speedBytesPerSecond == null ? t('测速中…', 'Measuring…') : `${formatBytes(task.speedBytesPerSecond)}/s`}</>}
                  </span>
                  <div className="drive-upload-track"><span style={{ width: `${progress}%` }} /></div>
                  {task.error && <small className="drive-danger-text">{task.error}</small>}
                </div>
                <div className="drive-upload-actions">
                  {task.state === 'downloading' && <button type="button" className="drive-icon-action" onClick={() => pauseDownloadTask(task)} aria-label={t(`暂停下载 ${task.node.name}`, `Pause download of ${task.node.name}`)}><Pause aria-hidden="true" /></button>}
                  {(task.state === 'paused' || task.state === 'error') && <button type="button" className="drive-icon-action" onClick={() => resumeDownloadTask(task)} aria-label={t(`继续下载 ${task.node.name}`, `Resume download of ${task.node.name}`)}><Play aria-hidden="true" /></button>}
                  <ClearButton variant="standalone" ariaLabel={task.state === 'downloading' || task.state === 'pausing' ? t(`取消下载 ${task.node.name}`, `Cancel download of ${task.node.name}`) : t('移除下载任务', 'Dismiss download')} onClick={() => removeDownloadTask(task)} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {view === 'files' && (
        <nav className="drive-breadcrumbs" aria-label={t('当前文件夹路径', 'Current folder path')}>
          <AppLink href="/drive" prefetch={false}>{t('我的文件', 'My files')}</AppLink>
          {breadcrumbs.map((crumb) => <span key={crumb.id}><span aria-hidden="true">/</span><AppLink href={`/drive?folder=${encodeURIComponent(crumb.id)}`} prefetch={false}>{crumb.name}</AppLink></span>)}
        </nav>
      )}

      <section className="drive-files" aria-label={view === 'trash' ? t('回收站项目', 'Trash items') : t('文件和文件夹', 'Files and folders')}>
        <div className="drive-file-head"><span>{t('名称', 'Name')}</span><span>{t('大小', 'Size')}</span><span>{t('更新时间', 'Updated')}</span><span>{t('操作', 'Actions')}</span></div>
        {loading && <div className="drive-loading"><Loader2 className="drive-spin" />{t('正在加载…', 'Loading…')}</div>}
        {!loading && snapshot?.nodes.length === 0 && <div className="drive-empty">{view === 'trash' ? t('回收站是空的。', 'Trash is empty.') : t('这里还没有文件。可拖入文件或点击上传。', 'No files here yet. Drop files here or use Upload.')}</div>}
        {!loading && snapshot?.nodes.map((node) => (
          <div className="drive-file-row" key={node.id}>
            <div className="drive-file-name"><FileKindIcon node={node} />{node.kind === 'folder' && view === 'files' ? <AppLink href={`/drive?folder=${encodeURIComponent(node.id)}`} prefetch={false}>{node.name}</AppLink> : <strong>{node.name}</strong>}</div>
            <span className="drive-file-size">{node.kind === 'file' ? formatBytes(node.sizeBytes) : '—'}</span>
            <time dateTime={node.updatedAt}>{new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(node.updatedAt))}</time>
            <div className="drive-file-actions">
              {view === 'files' && node.kind === 'file' && isDrivePreviewableMime(node.mimeType) && <button type="button" className="drive-icon-action" onClick={() => void setPreviewId(node.id)} aria-label={t(`预览 ${node.name}`, `Preview ${node.name}`)}><Eye aria-hidden="true" /></button>}
              {view === 'files' && node.kind === 'file' && <button type="button" className="drive-icon-action" onClick={() => void openShare(node)} aria-label={node.shared ? t(`管理 ${node.name} 的公开链接`, `Manage the public link for ${node.name}`) : t(`分享 ${node.name}`, `Share ${node.name}`)}>{node.shared ? <Link2 aria-hidden="true" /> : <Share2 aria-hidden="true" />}</button>}
              {view === 'files' && node.kind === 'file' && <button type="button" className="drive-icon-action" onClick={() => void downloadNode(node)} aria-label={t(`下载 ${node.name}`, `Download ${node.name}`)}><Download aria-hidden="true" /></button>}
              {view === 'files' && <button type="button" className="drive-icon-action" onClick={() => void renameNode(node)} aria-label={t(`重命名 ${node.name}`, `Rename ${node.name}`)}><Pencil aria-hidden="true" /></button>}
              {view === 'files' && <button type="button" className="drive-icon-action drive-danger" onClick={() => void moveToTrash(node)} aria-label={t(`移入回收站 ${node.name}`, `Move ${node.name} to Trash`)}><Trash2 aria-hidden="true" /></button>}
              {view === 'trash' && <button type="button" className="drive-icon-action" onClick={() => void restoreNode(node)} aria-label={t(`恢复 ${node.name}`, `Restore ${node.name}`)}><RotateCcw aria-hidden="true" /></button>}
              {view === 'trash' && <button type="button" className="drive-icon-action drive-danger" onClick={() => void permanentlyDelete(node)} aria-label={t(`永久删除 ${node.name}`, `Permanently delete ${node.name}`)}><Trash2 aria-hidden="true" /></button>}
            </div>
          </div>
        ))}
      </section>

      {dragging && view === 'files' && <div className="drive-drop-overlay"><Upload aria-hidden="true" /><strong>{t('松开即可上传', 'Drop to upload')}</strong></div>}

      {previewId && (
        <div className="drive-preview-backdrop" role="dialog" aria-modal="true" aria-label={t('文件预览', 'File preview')}>
          <div className="drive-preview">
            <div className="drive-preview-head"><strong>{preview?.node.name ?? t('正在准备预览…', 'Preparing preview…')}</strong><ClearButton variant="standalone" ariaLabel={t('关闭预览', 'Close preview')} onClick={() => void setPreviewId(null)} /></div>
            <div className="drive-preview-body">
              {!preview && <Loader2 className="drive-spin" />}
              {preview?.node.mimeType?.startsWith('image/') && <img src={preview.url} alt={preview.node.name} />}
              {preview?.node.mimeType?.startsWith('video/') && <video src={preview.url} controls autoPlay />}
              {preview?.node.mimeType?.startsWith('audio/') && <audio src={preview.url} controls autoPlay />}
              {preview && !/^(image|video|audio)\//.test(preview.node.mimeType ?? '') && <iframe src={preview.url} title={preview.node.name} sandbox="allow-same-origin" />}
            </div>
          </div>
        </div>
      )}

      {shareNode && (
        <DriveShareDialog
          node={shareNode}
          url={shareUrl}
          busy={shareBusy}
          onVisibilityChange={(shared) => void changeShareVisibility(shared)}
          onClose={() => { if (!shareBusy) { setShareNode(null); setShareUrl(null); } }}
        />
      )}
    </main>
  );
}

export default function DrivePage() {
  return <Suspense fallback={null}><DrivePageContent /></Suspense>;
}
