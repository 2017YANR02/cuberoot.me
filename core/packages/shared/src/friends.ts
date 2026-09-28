/** Runtime-neutral identities and relationships used by friends and chat. */
export type FriendRelationship = 'none' | 'incoming' | 'outgoing' | 'friends' | 'blocked';
export interface FriendUser {
  userId: number;
  name: string;
  avatarUrl: string | null;
  avatarSource: 'auto' | 'clawd' | 'upload';
  avatarPreset: string | null;
  wcaId: string | null;
}
export interface FriendSearchUser extends FriendUser { relationship: FriendRelationship }
export interface WcaFriendContact { wcaId: string; name: string; countryIso2: string }
export interface FriendsOverview {
  friends: FriendUser[];
  incoming: FriendUser[];
  outgoing: FriendUser[];
  blocked: FriendUser[];
  wcaContacts: WcaFriendContact[];
}
