// DB stores each subforum's icon as a lucide component name string; map it to
// the actual component here. Unknown names fall back to MessageSquare.

import {
  Megaphone, HelpCircle, BookOpen, MessageSquare, MessagesSquare, Box, Cpu,
  MonitorSmartphone, EyeOff, Sigma, TrendingUp, Trophy, Swords, Video, Medal,
  Coffee, Hand, LifeBuoy, Users, Globe, Wrench, GraduationCap, Puzzle, Timer,
  MessageCircleWarning,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Megaphone, HelpCircle, BookOpen, MessageSquare, MessagesSquare, Box, Cpu,
  MonitorSmartphone, EyeOff, Sigma, TrendingUp, Trophy, Swords, Video, Medal,
  Coffee, Hand, LifeBuoy, Users, Globe, Wrench, GraduationCap, Puzzle, Timer,
  MessageCircleWarning,
};

export function forumIcon(name: string): LucideIcon {
  return ICONS[name] ?? MessageSquare;
}
