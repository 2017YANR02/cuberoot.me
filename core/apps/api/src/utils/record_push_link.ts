import { competitionPushLink } from '@cuberoot/shared/notification-push';
/** Push destinations are restricted to public competition pages. */
export function recordPushUrl(link: string): string {
  if (!competitionPushLink(link)) throw new Error('Invalid record push link');
  return `https://cuberoot.me${link}`;
}
