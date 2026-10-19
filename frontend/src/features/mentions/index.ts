// Tiptap extensions
export { EntityMention } from "./EntityMention";
export type { EntityMentionAttrs } from "./EntityMention";
export { MentionSuggestion } from "./MentionSuggestion";
export type { MentionSuggestionOptions } from "./MentionSuggestion";

// Hooks
export { useMentionSync, useMentionSyncTargets, useMentionSearch, useMentionBacklinks, mentionKeys } from "./hooks";

// Components
export { BacklinksList } from "./BacklinksList";
export { MentionChipView } from "./MentionChipView";
export { MentionList } from "./MentionList";

// Types and constants
export type {
  MentionType,
  MentionSourceType,
  MentionSearchResult,
  MentionResolved,
  MentionBacklink,
  MentionRef,
} from "./types";
export { MENTION_TYPE_META, MENTION_TYPES, MENTION_FILTERS } from "./types";

export { MentionChip } from "./MentionChip";
export { MentionText } from "./MentionText";
export { MentionHtml } from "./MentionHtml";
export { MentionTextarea } from "./MentionTextarea";
export {
  mentionToken,
  hasMentionToken,
  parseMentionText,
  collectTextMentionRefs,
  collectHtmlMentionRefs,
} from "./text";
