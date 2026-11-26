import { writeFileSync } from 'node:fs';
import { buildAssistantFeatureLinkSource } from '../packages/client/scripts/build-assistant-feature-links.mts';

const source = await buildAssistantFeatureLinkSource();
writeFileSync(new URL('../packages/shared/src/site_assistant_feature_links.ts', import.meta.url), source);
