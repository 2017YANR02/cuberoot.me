---
layout: default
title: Upcoming Comps - Top Cubers
description: Track upcoming WCA competitions of the world's top cubers.
---

<link rel="stylesheet" href="{{ site.baseurl }}/assets/css/stats_ui.css">
<style>
/* ── 时间轴与卡片专属样式 ────────────────────────────── */
#upcoming-comps-container {
    max-width: 800px;
    margin: 20px auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.timeline-header {
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(138, 180, 248, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

.timeline-header h1 {
    margin: 0;
    font-size: 24px;
    color: #e8eaed;
}

.timeline-meta {
    font-size: 13px;
    color: #9aa0a6;
}

/* 时间轴主线 */
.timeline {
    position: relative;
    padding-left: 20px;
}
.timeline::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 2px;
    background: rgba(138, 180, 248, 0.15);
}

/* 比赛卡片 */
.comp-card {
    position: relative;
    background: rgba(25, 30, 45, 0.6);
    border: 1px solid rgba(138, 180, 248, 0.1);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    transition: transform 0.2s, box-shadow 0.2s;
}

.comp-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    border-color: rgba(138, 180, 248, 0.3);
}

/* 时间轴节点圆圈 */
.comp-card::before {
    content: '';
    position: absolute;
    top: 24px;
    left: -21px; /* 对齐左边主线 */
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #8ab4f8;
    box-shadow: 0 0 0 4px rgba(20, 25, 40, 1);
}

/* 神仙打架 高亮特效 */
.comp-card.highlight {
    background: rgba(138, 180, 248, 0.05);
    border: 1px solid rgba(138, 180, 248, 0.4);
    box-shadow: 0 0 15px rgba(138, 180, 248, 0.1);
}
.comp-card.highlight::before {
    background: #fbbc04; /* 金黄色 */
    box-shadow: 0 0 0 4px rgba(20, 25, 40, 1), 0 0 8px #fbbc04;
}

.comp-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.comp-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}
.comp-title a {
    color: #8ab4f8;
    text-decoration: none;
}
.comp-title a:hover {
    text-decoration: underline;
}

.comp-date {
    font-size: 14px;
    color: #abb2bf;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
}

.comp-location {
    font-size: 14px;
    color: #9aa0a6;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.badge-clash {
    display: inline-block;
    background: linear-gradient(135deg, #c73800, #b21f1f);
    color: white;
    font-size: 12px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
    margin-left: 8px;
    vertical-align: middle;
}

/* 参赛顶尖选手列表 */
.cuber-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.cuber-tag {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    background: rgba(138, 180, 248, 0.1);
    border: 1px solid rgba(138, 180, 248, 0.2);
    color: #e8eaed;
    padding: 5px 10px;
    border-radius: 16px;
    font-size: 13px;
    text-decoration: none;
    transition: all 0.2s;
}

.cuber-tag:hover {
    background: rgba(138, 180, 248, 0.2);
    border-color: rgba(138, 180, 248, 0.4);
    color: #fff;
}

/* 选手旁的事件简码标签 */
.cuber-tag .event-label {
    font-size: 11px;
    color: #9aa0a6;
    margin-left: 2px;
}

/* WR 红底白字圆角徽章 */
.wr-badge {
    display: inline-block;
    background: #d93025;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    line-height: 1.3;
    vertical-align: middle;
    margin-left: 1px;
}

/* 占位与错误状态 */
.state-message {
    text-align: center;
    padding: 40px;
    color: #8ab4f8;
    font-size: 16px;
}
</style>

<div id="upcoming-comps-container">
    <div class="timeline-header">
        <h1>Top Cubers' Upcoming Comps</h1>
        <div class="timeline-meta" id="update-meta">加载中...</div>
    </div>
    
    <div id="timeline-body" class="timeline">
        <div class="state-message">Loading schedule data...</div>
    </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const DATA_URL = '{{ site.baseurl }}/stats/upcoming_comps.json';
    const timelineBody = document.getElementById('timeline-body');
    const updateMeta = document.getElementById('update-meta');

    // 工具函数：格式化日期 (e.g., "2026-03-07" -> "Mar 7")
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // 渲染主流程
    fetch(DATA_URL)
        .then(response => {
            if (!response.ok) throw new Error('Failed to load JSON');
            return response.json();
        })
        .then(data => {
            // 更新元信息
            let timeStr = new Date(data.updated_at).toLocaleString();
            updateMeta.textContent = `Updated: ${timeStr} | Tracking ${data.total_cubers_tracked} players`;

            const comps = data.competitions || [];
            if (comps.length === 0) {
                timelineBody.innerHTML = '<div class="state-message">No upcoming competitions found for the tracked players.</div>';
                return;
            }

            // 生成 HTML
            let html = '';
            comps.forEach(comp => {
                // 如果单场比赛有多于等于 3 名顶尖玩家参加，视为 "神仙打架"
                const isClash = comp.top_cubers.length >= 3;
                const highlightClass = isClash ? 'highlight' : '';
                const clashBadge = isClash ? '<span class="badge-clash">🔥 Clashing</span>' : '';

                // 日期字符串
                let dateDisplay = formatDate(comp.start_date);
                if (comp.end_date && comp.end_date !== comp.start_date) {
                    dateDisplay += ' - ' + formatDate(comp.end_date);
                }

                // 地区
                const locDisplay = `${comp.city}, ${comp.country}`;

                // 选手标签（含事件简码 + WR 徽章）
                const cubersHtml = comp.top_cubers.map(c => {
                    // NOTE: 构建事件标签，如 "333 WR 444 555"
                    let evHtml = '';
                    if (c.events && c.events.length > 0) {
                        const evParts = c.events.map(ev => {
                            const wrBadge = ev.wr ? '<span class="wr-badge">WR</span>' : '';
                            return `${ev.id}${wrBadge}`;
                        });
                        evHtml = `<span class="event-label">${evParts.join(' ')}</span>`;
                    }
                    return `<a href="https://www.worldcubeassociation.org/persons/${c.id}" class="cuber-tag" target="_blank" rel="noopener noreferrer">${c.name} ${evHtml}</a>`;
                }).join('');

                const eventHtml = comp.events ? `<div style="font-size: 12px; color: #556070; margin-top: 4px;">Events: ${comp.events.join(', ')}</div>` : '';

                html += `
                <div class="comp-card ${highlightClass}">
                    <div class="comp-header">
                        <h2 class="comp-title">
                            <a href="https://www.worldcubeassociation.org/competitions/${comp.id}" target="_blank" rel="noopener noreferrer">
                                ${comp.name}
                            </a>
                            ${clashBadge}
                        </h2>
                        <div class="comp-date">${dateDisplay}</div>
                    </div>
                    <div class="comp-location">📍 ${locDisplay}</div>
                    ${eventHtml}
                    <div class="cuber-list">
                        ${cubersHtml}
                    </div>
                </div>
                `;
            });

            timelineBody.innerHTML = html;
        })
        .catch(error => {
            console.error('Error fetching comp data:', error);
            timelineBody.innerHTML = '<div class="state-message" style="color: #f28b82;">Failed to load upcoming competitions data. Please try again later.</div>';
        });
});
</script>
