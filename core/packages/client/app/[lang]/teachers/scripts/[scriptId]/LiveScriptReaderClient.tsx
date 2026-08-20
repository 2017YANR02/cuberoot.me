'use client';

import { useEffect, useState } from 'react';
import AppLink from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { fetchTeacherLiveScript, type TeacherLiveScript } from '@/lib/teacher-live-scripts-api';
import LiveScriptDocument from '../LiveScriptDocument';

function idFromLocation(): number {
  if (typeof window === 'undefined') return 0;
  const match = window.location.pathname.match(/\/teachers\/scripts\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

export default function LiveScriptReaderClient() {
  const [script, setScript] = useState<TeacherLiveScript | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const id = idFromLocation();
    if (!id) { setError(tr({ zh: '话术链接无效。', en: 'This script link is invalid.' })); return; }
    let active = true;
    fetchTeacherLiveScript(id).then((value) => { if (active) setScript(value); }).catch(() => { if (active) setError(tr({ zh: '这条话术不存在，或你没有查看权限。', en: 'This script does not exist or you do not have permission to view it.' })); });
    return () => { active = false; };
  }, []);
  if (script) return <LiveScriptDocument script={script} />;
  return <main className="script-state-page"><p>{error || tr({ zh: '正在加载话术…', en: 'Loading the script…' })}</p>{error && <AppLink href="/teachers/scripts">{tr({ zh: '返回话术库', en: 'Back to the library' })}</AppLink>}</main>;
}
