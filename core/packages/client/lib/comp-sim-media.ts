export interface CompSimInspectionVoice {
  eight: string;
  twelve: string;
}

export interface CompSimCrowdVideo {
  src: string;
  poster?: string;
}

export interface CompSimMediaManifest {
  ambience: readonly string[];
  effects: readonly string[];
  inspectionVoices: readonly CompSimInspectionVoice[];
  announcements: {
    events: Readonly<Record<string, readonly string[]>>;
    rounds: Readonly<Record<string, readonly string[]>>;
    groups: Readonly<Record<string, readonly string[]>>;
  };
  crowdVideos: readonly CompSimCrowdVideo[];
}

/**
 * Media is intentionally empty until the authorized audio/video pack is
 * supplied. The simulator treats every collection as an optional capability,
 * so missing assets never create empty requests or block a round.
 */
export const COMP_SIM_MEDIA: CompSimMediaManifest = {
  ambience: [],
  effects: [],
  inspectionVoices: [],
  announcements: { events: {}, rounds: {}, groups: {} },
  crowdVideos: [],
};
