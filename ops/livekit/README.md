# LiveKit 部署(境内节点)

`/timer` 联机对战房间的视频通话媒体面。**这个目录不在任何 CI 流水线里**,全部手动部署 ——
LiveKit 跑在境内节点上,与主站服务器是两台机器。

## 为什么在境内

同一个 LiveKit 房间的所有参与者必须落在同一个节点上(跨节点级联是 LiveKit Cloud 的能力,
开源版没有)。大陆用户占多数时,SFU 放境内意味着大陆用户之间零跨境;放境外则**每个**大陆
用户都要跨境。少数海外参与者只有自己那一条腿跨境,由 ICE/TCP 兜底。

## 前置条件

1. RTC 子域名(如 `rtc.<主域名>`)解析到境内节点,且主域名已备案。
2. 该子域名的 TLS 证书(信令走 WSS,必须有证书;`getUserMedia` 也要求安全上下文)。
3. 防火墙放行:**TCP 443**(信令)、**TCP 7881**(ICE/TCP 兜底)、**UDP 7882-7892**(媒体)。
   UDP 那段最容易漏 —— 漏了的表现是"能进房、能看到人、但没有画面和声音"。

## 安装

```bash
# 1. 二进制
curl -sSL https://get.livekit.io | bash

# 2. 配置
sudo mkdir -p /etc/livekit
sudo cp livekit.yaml /etc/livekit/livekit.yaml

# 3. 生成 key/secret 并写入 env(不进仓库,权限 600)
livekit-server generate-keys        # 输出形如  APIxxxxxxxx: <secret>
sudo tee /etc/livekit/livekit.env >/dev/null <<'EOF'
LIVEKIT_KEYS=APIxxxxxxxx: <secret>
EOF
sudo chmod 600 /etc/livekit/livekit.env

# 4. systemd
sudo cp livekit.service /etc/systemd/system/livekit.service
sudo systemctl daemon-reload
sudo systemctl enable --now livekit
journalctl -u livekit -f

# 5. nginx(先把 rtc.nginx.conf 里的 rtc.example.com 换成真实域名)
sudo cp rtc.nginx.conf /etc/nginx/conf.d/rtc.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 主站 API 需要的 env

Hono(`api.<主域名>`,跑在主站服务器上)要这三个,缺任一项 `/v1/video/config` 就返回
`enabled:false`,前端完全隐藏视频入口:

```
LIVEKIT_URL=wss://rtc.<主域名>
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=<secret>
```

`LIVEKIT_URL` 一个值两用:前端拿它连 WSS,服务端把 `wss://` 换成 `https://` 后用
`RoomServiceClient` 查在线房间算带宽 —— 所以主站服务器必须能访问到 RTC 域名的 443。
主站与 LiveKit 不同机时这是一次跨机 HTTP,只发生在进房那一刻,不影响通话本身。

## 带宽

单房出向 ≈ `n*(n-1)*3` Mbps(n 人,1080p 单路 3 Mbps):二人 6、三人 18、四人 36。
服务端 `routes/video_rooms.ts` 里 `BANDWIDTH_BUDGET_MBPS = 140`(实例峰值 200,留 30%
给站点自身流量),签 token 前会查一遍在线房间累加,超预算直接拒发。

**改带宽预算或单路码率时,`video_rooms.ts` 的 `PER_STREAM_MBPS` 与 client
`lib/video-room-api.ts` 的 `VIDEO_MAX_BITRATE` 必须同时改** —— 服务端按前者守预算,
客户端按后者真发,两个数不一致就会超卖或白拒。

## 排障

| 现象 | 多半是 |
|---|---|
| 一直重连,报 signal connection failed | nginx 漏了 `Upgrade`/`Connection` 两个 header |
| 能进房、看得到人、但没画面没声音 | UDP 7882-7892 没放行 |
| 严格网络(公司/校园)下连不上 | TCP 7881 没放行 |
| ICE candidate 里是内网地址 | `rtc.use_external_ip` 没开 |
| 前端根本不显示"开视频" | 主站 API 少配了三个 env 之一 |
| 提示"服务器视频带宽已满" | 到 `BANDWIDTH_BUDGET_MBPS` 上限了,不是 bug |
