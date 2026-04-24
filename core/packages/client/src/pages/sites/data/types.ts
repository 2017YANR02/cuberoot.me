export type GroupId =
  | 'competition'
  | 'timer'
  | 'learning'
  | 'algorithms'
  | 'events'
  | 'recon'
  | 'simulators'
  | 'solvers'
  | 'cubers'
  | 'shop';

export interface Site {
  id: string;
  name: string;
  name_en?: string;
  name_zh?: string;
  url: string;
  alt_urls?: string[];
  author?: string;
  desc_en?: string;
  desc_zh?: string;
  youtube?: string;
  group: GroupId;
  subgroup?: string;
  status?: 'dead';
}
