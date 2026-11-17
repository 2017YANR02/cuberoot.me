import { applyTimerLivePatch, diffTimerLiveSnapshot, isTimerLiveId, isTimerLiveToken, isTimerLiveViewerToken, parseTimerLiveDetail, parseTimerLiveSnapshot,
  TIMER_LIVE_MAX_BYTES, TIMER_LIVE_STALE_MS, TIMER_LIVE_TTL_MS, type TimerLiveSnapshot } from '@cuberoot/shared/timer/live-share';

export interface TimerLiveSocket { readonly bufferedAmount?: number; send(data: string): void; close(code: number, reason: string): void }
export type TimerLiveAuthorize = (id: string, token: string, role: 'host' | 'viewer') => Promise<{ expiresAt: number } | null>;
interface Peer { socket: TimerLiveSocket; role: 'host' | 'viewer'; id: string; alive: number; count: number; window: number }
interface Room { host?: Peer; viewers: Set<Peer>; snapshot: TimerLiveSnapshot | null; revision: number; expiresAt: number; touched: number }

/** One API process owns transient state; capabilities are authorized against persistent storage. */
export class TimerLiveRelay {
  private rooms = new Map<string, Room>();
  private pending = new Map<string, number>();
  private revoked = new Map<string, number>();
  private sizes = new WeakMap<object, number>();
  constructor(private authorize: TimerLiveAuthorize) {}
  private send(peer: Peer, message: unknown): boolean {
    const data = JSON.stringify(message);
    if ((peer.socket.bufferedAmount ?? 0) + Buffer.byteLength(data) > TIMER_LIVE_MAX_BYTES * 2) {
      this.close(peer, 1013, 'slow connection'); return false;
    }
    try { peer.socket.send(data); return true; } catch { this.close(peer, 1011, 'send failed'); return false; }
  }
  private close(peer: Peer, code: number, reason: string) {
    const room = this.rooms.get(peer.id);
    if (room?.host === peer) room.host = undefined;
    room?.viewers.delete(peer);
    try { peer.socket.close(code, reason); } catch { /* already closed */ }
  }
  private status(room: Room) {
    const message = { type: 'status', online: !!room.host, viewers: room.viewers.size, serverNow: Date.now() };
    if (room.host) this.send(room.host, message);
    for (const p of [...room.viewers]) this.send(p, message);
  }
  revoke(id: string) {
    this.revoked.set(id, Date.now() + TIMER_LIVE_TTL_MS);
    const room = this.rooms.get(id);
    if (!room) return;
    for (const p of [...room.viewers, ...(room.host ? [room.host] : [])]) this.close(p, 4001, 'share ended');
    this.rooms.delete(id);
  }
  sweep(now = Date.now()) {
    for (const [id, expires] of this.revoked) if (expires <= now) this.revoked.delete(id);
    for (const [id, room] of this.rooms) {
      if (room.expiresAt <= now) { this.revoke(id); continue; }
      if (now - room.touched > 60_000 && !room.host && !room.viewers.size) { this.rooms.delete(id); continue; }
      for (const p of [...room.viewers, ...(room.host ? [room.host] : [])]) {
        if (now - p.alive > TIMER_LIVE_STALE_MS) this.close(p, 1012, 'heartbeat timeout');
      }
      this.status(room);
    }
  }
  connect(socket: TimerLiveSocket, clientKey: string) {
    let peer: Peer | null = null, closed = false, authenticating = false;
    const pendingCount = this.pending.get(clientKey) ?? 0;
    if (pendingCount >= 8) { socket.close(1008, 'pending limit'); return { handleMessage() {}, handleClose() {} }; }
    this.pending.set(clientKey, pendingCount + 1);
    let pending = true;
    const release = () => { if (!pending) return; pending = false;
      const count = (this.pending.get(clientKey) ?? 1) - 1;
      if (count) this.pending.set(clientKey, count); else this.pending.delete(clientKey); };
    const reject = (code: number, reason: string) => {
      closed = true; release(); clearTimeout(timeout);
      if (peer) { const room = this.rooms.get(peer.id); this.close(peer, code, reason); if (room) this.status(room); }
      else socket.close(code, reason);
    };
    const timeout = setTimeout(() => reject(1008, 'hello timeout'), 5000); timeout.unref();
    return {
      handleMessage: (data: unknown) => {
        if (closed) return;
        if (typeof data !== 'string' || Buffer.byteLength(data) > TIMER_LIVE_MAX_BYTES) { reject(1008, 'payload too large'); return; }
        let m: Record<string, unknown>;
        try { m = JSON.parse(data); if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error(); }
        catch { reject(1008, 'invalid json'); return; }
        if (!peer) {
          if (authenticating || m.type !== 'hello' || m.version !== 1 || !isTimerLiveId(m.id)
            || !isTimerLiveViewerToken(m.token) || (m.role === 'host' && !isTimerLiveToken(m.token))
            || (m.role !== 'host' && m.role !== 'viewer')) { reject(1008, 'invalid hello'); return; }
          authenticating = true;
          const { id, token, role } = m;
          void this.authorize(id, token, role).then(access => {
            if (closed) return;
            if (!access || access.expiresAt <= Date.now() || this.revoked.has(id)) { reject(4001, 'share ended'); return; }
            let room = this.rooms.get(id);
            if (!room) {
              if (this.rooms.size >= 64) { reject(1013, 'relay full'); return; }
              room = { viewers: new Set(), snapshot: null, revision: 0, expiresAt: access.expiresAt, touched: Date.now() };
              this.rooms.set(id, room);
            }
            if (role === 'viewer' && room.viewers.size >= 16) { reject(1008, 'viewer limit'); return; }
            peer = { socket, id, role, alive: Date.now(), count: 0, window: Date.now() };
            clearTimeout(timeout); release();
            if (role === 'host') { if (room.host) this.close(room.host, 4000, 'publisher replaced'); room.host = peer; }
            else room.viewers.add(peer);
            this.send(peer, { type: 'ready', expiresAt: room.expiresAt, serverNow: Date.now() });
            if (role === 'viewer' && room.snapshot) this.send(peer, { type: 'snapshot', snapshot: room.snapshot, revision: room.revision });
            this.status(room);
          }).catch(() => reject(1011, 'authorization unavailable'));
          return;
        }
        const room = this.rooms.get(peer.id);
        if (!room || room.expiresAt <= Date.now() || peer.role === 'host' && room.host !== peer
          || peer.role === 'viewer' && !room.viewers.has(peer)) { reject(4001, 'share ended'); return; }
        if (Date.now() - peer.window >= 10_000) { peer.count = 0; peer.window = Date.now(); }
        if (++peer.count > (peer.role === 'host' ? 400 : 60)) { reject(1008, 'rate limit'); return; }
        peer.alive = room.touched = Date.now();
        if (m.type === 'ping' && typeof m.sentAt === 'number' && Number.isFinite(m.sentAt)) {
          this.send(peer, { type: 'pong', sentAt: m.sentAt, serverNow: Date.now() }); return;
        }
        if (peer.role === 'viewer') {
          if (m.type === 'resync') { if (room.snapshot) this.send(peer, { type: 'snapshot', snapshot: room.snapshot, revision: room.revision }); return; }
          if (m.type === 'detail' && typeof m.solveId === 'string' && typeof m.context === 'string'
            && typeof m.requestId === 'string' && m.requestId.length <= 64) {
            if (room.host && m.context === room.snapshot?.state.context && room.snapshot.history.some(s => s.id === m.solveId))
              this.send(room.host, { type: 'detail', solveId: m.solveId, context: m.context, requestId: m.requestId });
            return;
          }
          reject(1008, 'viewer is read only'); return;
        }
        if (m.type === 'detail') {
          const detail = parseTimerLiveDetail(m.solve);
          if (!detail || typeof m.requestId !== 'string' || m.requestId.length > 64) { reject(1008, 'invalid detail'); return; }
          if (m.context !== room.snapshot?.state.context || !room.snapshot?.history.some(s => s.id === detail.id)) return;
          for (const p of [...room.viewers]) this.send(p, { type: 'detail', context: m.context, requestId: m.requestId, solve: detail });
          return;
        }
        if (m.type !== 'snapshot' && m.type !== 'patch') { reject(1008, 'invalid message'); return; }
        if (m.type === 'patch' && (m.base !== room.revision || !room.snapshot)) { this.send(peer, { type: 'resync' }); return; }
        const next = m.type === 'snapshot' ? parseTimerLiveSnapshot(m.snapshot) : applyTimerLivePatch(room.snapshot!, m.patch);
        const size = (value: object | null) => {
          if (!value) return 4;
          let bytes = this.sizes.get(value);
          if (bytes === undefined) { bytes = Buffer.byteLength(JSON.stringify(value)); this.sizes.set(value, bytes); }
          return bytes;
        };
        if (!next || Object.values(next).reduce((total, part) => total + size(part), 100) > TIMER_LIVE_MAX_BYTES - 1024) { reject(1008, 'invalid snapshot'); return; }
        const previous = room.snapshot;
        room.snapshot = next;
        room.revision++;
        this.send(peer, { type: 'ack', revision: room.revision });
        const message = m.type === 'snapshot' ? { type: 'snapshot', snapshot: next, revision: room.revision }
          : { type: 'patch', patch: diffTimerLiveSnapshot(previous!, next), revision: room.revision };
        for (const p of [...room.viewers]) this.send(p, message);
      },
      handleClose: () => {
        closed = true; clearTimeout(timeout); release();
        if (peer) { const room = this.rooms.get(peer.id); this.close(peer, 1000, 'disconnected'); if (room) this.status(room); }
      },
    };
  }
}
