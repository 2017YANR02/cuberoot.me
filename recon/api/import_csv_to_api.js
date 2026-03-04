/**
 * 一次性迁移脚本：将 recon_data.json 导入 PHP 后端
 * NOTE: 分批导入（每批 100 条），避免 PHP post_max_size 限制
 * 
 * 用法：
 *   1. 确保 PHP 后端已部署（含 import action）
 *   2. node import_csv_to_api.js
 */

const fs = require('fs');
const path = require('path');

// NOTE: 本地 localhost 用于测试，阿里云用于生产
const API_BASE = 'http://localhost:4000/recon/api/';
// const API_BASE = 'https://toolkit.cuberoot.me/recon/api/';

const BATCH_SIZE = 100; // NOTE: 每批导入条数
const DATA_FILE = path.join(__dirname, '..', 'recon_data.json');

async function main() {
    // NOTE: 读取 CSV 数据
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const solves = data.solves || [];
    console.log(`共 ${solves.length} 条数据，分 ${Math.ceil(solves.length / BATCH_SIZE)} 批导入`);

    // NOTE: 分批导入
    let imported = 0;
    for (let i = 0; i < solves.length; i += BATCH_SIZE) {
        const batch = solves.slice(i, i + BATCH_SIZE);
        const url = API_BASE + '?action=import';

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solves: batch })
        });

        if (!resp.ok) {
            const text = await resp.text();
            console.error(`第 ${i / BATCH_SIZE + 1} 批失败: ${resp.status} ${text}`);
            process.exit(1);
        }

        const result = await resp.json();
        imported += batch.length;
        console.log(`批次 ${Math.floor(i / BATCH_SIZE) + 1}: 导入 ${batch.length} 条, 累计 ${imported}, nextId=${result.nextId || '?'}`);
    }

    console.log(`\n导入完成！共 ${imported} 条。`);

    // NOTE: 验证：读取全部数据并检查数量
    const verifyResp = await fetch(API_BASE + '?action=list');
    const allRecons = await verifyResp.json();
    console.log(`验证：API 返回 ${allRecons.length} 条数据`);
    if (allRecons.length >= solves.length) {
        console.log('✅ 数量匹配');
    } else {
        console.log('⚠️ 数量不匹配，请检查');
    }
}

main().catch(err => {
    console.error('导入失败:', err);
    process.exit(1);
});
