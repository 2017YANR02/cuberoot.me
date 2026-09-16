'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DailyChallengePage() {
  const [challenge, setChallenge] = useState<any>(null);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [attempts, setAttempts] = useState(3);
  const [myRecord, setMyRecord] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [shareText, setShareText] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    // 从后端获取今日挑战和排行榜
    fetch('/api/daily-challenge/today')
      .then(res => res.json())
      .then(data => {
        if (data.challenge) setChallenge(data.challenge);
        if (data.myRecord) {
          setMyRecord(data.myRecord);
          setAttempts(0); 
        } else {
          setAttempts(data.attemptsLeft);
        }
      });
    fetch('/api/daily-challenge/leaderboard')
      .then(res => res.json())
      .then(data => setLeaderboard(data.leaderboard || []));
  }, []);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => setTime((t) => t + 10), 10);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleToggle = async () => {
    if (attempts <= 0) return alert('今日机会已用完！');
    
    if (isRunning) {
      setIsRunning(false);
      const finalTimeMs = time;
      const solution = "R U R' U' F R U R' U' F'"; // 演示步骤，实际应接入计时器记录的真实步骤

      // 扣除一次机会
      setAttempts(prev => prev - 1);

      // 提交到后端
      const res = await fetch('/api/daily-challenge/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          challengeId: challenge?.id, 
          timeMs: finalTimeMs, 
          solution: solution 
        })
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitResult(data);
        setMyRecord({ time_ms: finalTimeMs });
        // 刷新排行榜
        const lb = await fetch('/api/daily-challenge/leaderboard').then(r => r.json());
        setLeaderboard(lb.leaderboard || []);
      } else {
        alert(data.error);
      }
    } else {
      setTime(0);
      setIsRunning(true);
      setCopied(false);
      setSubmitResult(null);
    }
  };

  const generateShareText = () => {
    if (!submitResult) return;
    const text = `CubeRoot 每日挑战 · ${new Date().toLocaleDateString()}
三阶速拧 | 成绩：${(time / 1000).toFixed(2)}s
击败了全网 ${submitResult.beatPercent}% 的魔友，排名 #${submitResult.rank}！
快来挑战你的今日极限 👉 https://cuberoot.me/zh/daily-challenge`;
    setShareText(text);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  if (!isMounted || !challenge) return <div className="p-10 text-center">加载中...</div>;

  return (
    <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded-2xl shadow-xl border">
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">每日挑战</h1>
      <p className="text-gray-500 text-sm text-center mb-6">
        {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-blue-600 font-semibold">今日打乱公式</span>
          <span className={`font-bold ${attempts <= 0 ? 'text-red-500' : 'text-blue-600'}`}>
            剩余机会：{attempts} / 3
          </span>
        </div>
        <code className="block text-center font-mono text-lg font-bold text-gray-800 break-all bg-white p-2 rounded-lg">
          {challenge.scramble}
        </code>
      </div>

      <div className="text-center mb-6">
        <div className="text-6xl font-mono font-bold text-gray-800">{(time / 1000).toFixed(2)}</div>
        <div className="text-sm text-gray-400 mt-1">
          {isRunning ? '计时中... 点击停止' : myRecord ? '今日已完成' : '点击开始挑战'}
        </div>
      </div>

      {!myRecord ? (
        <button 
          onClick={handleToggle}
          disabled={attempts <= 0}
          className={`w-full py-4 rounded-xl font-bold text-xl transition-all shadow-md mb-6 ${
            attempts <= 0 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : isRunning ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'
          }`}
        >
          {attempts <= 0 ? '今日机会已用完' : isRunning ? '停止计时' : '开始挑战'}
        </button>
      ) : (
        <div className="text-center bg-green-50 text-green-700 p-4 rounded-xl mb-6 font-bold">
          今日已完成：{(myRecord.time_ms / 1000).toFixed(2)}s
        </div>
      )}

      {submitResult && (
        <div className="text-center bg-yellow-50 border border-yellow-200 p-5 rounded-xl mb-6">
          <p className="text-gray-700 mb-2">
            今日排名：<span className="font-bold text-yellow-600">第 {submitResult.rank} 名</span>，
            击败了全网 {submitResult.beatPercent}% 的魔友
          </p>
          <button
            onClick={generateShareText}
            className="bg-green-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600"
          >
            {copied ? '✅ 已复制分享文案' : '📋 生成分享文案'}
          </button>
        </div>
      )}

      <div className="border-t pt-4">
        <h3 className="font-semibold text-gray-700 mb-3 text-center">今日排行榜</h3>
        <ul className="space-y-1 text-sm">
          {leaderboard.map((item, i) => (
            <li key={i} className="flex justify-between bg-gray-50 px-3 py-2 rounded">
              <span>#{i + 1} {item.username}</span>
              <span className="font-mono">{(item.time_ms / 1000).toFixed(2)}s</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
