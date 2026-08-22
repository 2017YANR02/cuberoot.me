# LiveKit 部署

`/timer` 联机对战房间的视频通话媒体面。**已于 2026-08-04 部署上线**,本文档同时是安装记录
和重建手册。

## 拓扑:单机

LiveKit 与全站跑在**同一台服务器**上(nginx / cuberoot-next / mira-next /
core-api / PostgreSQL 都在这台),该机在境内。所以没有"媒体节点"与"主站"之分 ——
LiveKit 是这台机器上多出来的一个 systemd 服务。

这对大陆用户是好事:同一个 LiveKit 房间的所有参与者必须落在同一节点(跨节点级联是
LiveKit Cloud 的能力,开源版没有),而这个节点本来就在境内,大陆用户之间零跨境。少数海外
参与者只有自己那一条腿跨境,由 ICE/TCP 兜底。

代价是**资源共享**:这台是 2 vCPU / 4 GiB,且历史上 OOM 过(core-api 重启计数三位数)。
SFU 不转码,CPU 便宜;真正要盯的是内存和带宽。

## 组件清单

| 位置 | 内容 | 谁部署 |
|---|---|---|
| `/usr/local/bin/livekit-server` | 二进制 v1.13.5 | 手动 |
| `/etc/livekit/livekit.yaml` | 本目录 `livekit.yaml` | 手动 |
| `/etc/livekit/livekit.env` | `LIVEKIT_KEYS=<key>: <secret>`,权限 600 | 手动生成,**不进仓库** |
| `/etc/systemd/system/livekit.service` | 本目录 `livekit.service` | 手动 |
| `/etc/sysctl.d/99-livekit.conf` | UDP 缓冲区调到 5MB | 手动 |
| `/etc/nginx/vhost.d/rtc.cuberoot.me.conf` | `ops/nginx/rtc.cuberoot.me.conf` | **CI**(deploy_nginx.yml) |
| `/root/core-api/.env` 三行 | `LIVEKIT_URL/API_KEY/API_SECRET` | 手动 |

## 端口

| 端口 | 用途 | 走 nginx? |
|---|---|---|
| TCP 443 | 信令(WSS)→ 127.0.0.1:7880 | 是 |
| TCP 7881 | ICE/TCP 兜底(严格网络) | 否,直连 |
| UDP 7882-7892 | 媒体(端口复用) | 否,直连 |

主机 firewalld 是关的,**唯一的门是云控制台的安全组** —— 7881/7882-7892 必须在那里放行,
在服务器上是查不出来的。漏开 UDP 的表现是「能进房、看得到人、但没画面没声音」。

## 重建步骤

```bash
# 1. 二进制。境内直连 get.livekit.io 会超时,从本机下载再流式装:
#    curl -sL -o livekit.tar.gz https://github.com/livekit/livekit/releases/download/v1.13.5/livekit_1.13.5_linux_amd64.tar.gz
#    cat livekit.tar.gz | ssh <host> 'tar xzOf - livekit-server > /usr/local/bin/livekit-server && chmod 0755 /usr/local/bin/livekit-server'

# 2. 配置 + 密钥
mkdir -p /etc/livekit
# 把本目录的 livekit.yaml 放到 /etc/livekit/livekit.yaml
OUT=$(livekit-server generate-keys)
K=$(echo "$OUT" | awk '/API Key:/{print $3}'); S=$(echo "$OUT" | awk '/API Secret:/{print $3}')
printf 'LIVEKIT_KEYS=%s: %s\n' "$K" "$S" > /etc/livekit/livekit.env
chmod 600 /etc/livekit/livekit.env

# 3. UDP 缓冲区(默认 ~425KB,媒体转发下会丢包)
printf 'net.core.rmem_max=5000000\nnet.core.wmem_max=5000000\n' > /etc/sysctl.d/99-livekit.conf
sysctl -p /etc/sysctl.d/99-livekit.conf

# 4. systemd
# 把本目录的 livekit.service 放到 /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now livekit

# 5. 证书(子域走 certbot webroot;apex+www 才是 acme.sh DNS-01,别混)
certbot certonly --webroot -w /www/wwwroot/cuberoot-spa -d rtc.cuberoot.me --non-interactive --agree-tos

# 6. nginx vhost 由 deploy_nginx.yml 投放;手动应急时直接放 /etc/nginx/vhost.d/ 再 nginx -t && reload

# 7. core-api 的三个 env(见下),然后 pm2 restart core-api --update-env
```

## core-api 需要的 env

缺任一项 `/v1/video/config` 就返回 `enabled:false`,前端完全隐藏视频入口:

```
LIVEKIT_URL=wss://rtc.cuberoot.me
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
```

`LIVEKIT_URL` 一个值两用:前端拿它连 WSS,服务端把 `wss://` 换成 `https://` 后用
`RoomServiceClient` 查在线房间算带宽。**密钥必须与 `/etc/livekit/livekit.env` 一致**,
不一致的表现是签出的 token LiveKit 一律 401。

## 带宽

单房出向 ≈ `n*(n-1)*3` Mbps(n 人,1080p 单路 3 Mbps):二人 6、三人 18、四人 36。
`routes/video_rooms.ts` 的 `BANDWIDTH_BUDGET_MBPS = 140`(实例峰值 200,留 30% 给站点
自身流量),签 token 前查一遍在线房间累加,超预算直接拒发。

**改带宽预算或单路码率时,`video_rooms.ts` 的 `PER_STREAM_MBPS` 与 client
`lib/video-room-api.ts` 的 `VIDEO_MAX_BITRATE` 必须同时改** —— 有 CI 守卫
`tests/video-bitrate-sync.test.ts` 卡着,漏改会红。

## 排障

| 现象 | 多半是 |
|---|---|
| 前端根本不显示「开视频」 | core-api 少配了三个 env 之一,或后端还没重新部署 |
| 一直重连,报 signal connection failed | nginx 漏了 `Upgrade`/`Connection` 两个 header |
| 能进房、看得到人、但没画面没声音 | 安全组没放行 UDP 7882-7892 |
| 严格网络(公司/校园)下连不上 | 安全组没放行 TCP 7881 |
| token 一律 401 | core-api 的 key/secret 与 /etc/livekit/livekit.env 不一致 |
| ICE candidate 里是内网地址 | `rtc.use_external_ip` 没开 |
| 提示「服务器视频带宽已满」 | 到 `BANDWIDTH_BUDGET_MBPS` 上限了,不是 bug |
| 日志 warn "UDP receive buffer is too small" | `/etc/sysctl.d/99-livekit.conf` 没生效,重启 livekit |

## 健康检查

```bash
curl https://rtc.cuberoot.me/          # → OK
systemctl is-active livekit            # → active
journalctl -u livekit -n 30 --no-pager
```
