export enum ChannelType {
  GUILD_TEXT = 0,
  GUILD_VOICE = 2,
  GUILD_CATEGORY = 4,
  GUILD_ANNOUNCEMENT = 5,
  GUILD_FORUM = 15,
  GUILD_STAGE_VOICE = 13,
  GUILD_DIRECTORY = 14,
  GUILD_MEDIA = 16,
  GUILD_THREAD = 11,
  GUILD_INTRODUCTION = 20,
  GUILD_SUGGESTION = 21,
  GUILD_POLL = 22,
  GUILD_GALLERY = 23,
  GUILD_DOC = 24,
  GUILD_CONTENT = 25,
  GUILD_COUNTING = 26,
  GUILD_VENT = 27,
}

/** Map string types to enum */
export function parseChannelType(type: string | number): ChannelType {
  if (typeof type === 'number') return type;
  const map: Record<string, ChannelType> = {
    text: ChannelType.GUILD_TEXT,
    voice: ChannelType.GUILD_VOICE,
    category: ChannelType.GUILD_CATEGORY,
    announcement: ChannelType.GUILD_ANNOUNCEMENT,
    forum: ChannelType.GUILD_FORUM,
    stage: ChannelType.GUILD_STAGE_VOICE,
    directory: ChannelType.GUILD_DIRECTORY,
    media: ChannelType.GUILD_MEDIA,
    thread: ChannelType.GUILD_THREAD,
    introduction: ChannelType.GUILD_INTRODUCTION,
    suggestion: ChannelType.GUILD_SUGGESTION,
    poll: ChannelType.GUILD_POLL,
    gallery: ChannelType.GUILD_GALLERY,
    doc: ChannelType.GUILD_DOC,
    content: ChannelType.GUILD_CONTENT,
    counting: ChannelType.GUILD_COUNTING,
    vent: ChannelType.GUILD_VENT,
  };
  return map[type] ?? ChannelType.GUILD_TEXT;
}

/** Map enum to string */
export function channelTypeToString(type: ChannelType): string {
  const map: Record<number, string> = {
    [ChannelType.GUILD_TEXT]: 'text',
    [ChannelType.GUILD_VOICE]: 'voice',
    [ChannelType.GUILD_CATEGORY]: 'category',
    [ChannelType.GUILD_ANNOUNCEMENT]: 'announcement',
    [ChannelType.GUILD_FORUM]: 'forum',
    [ChannelType.GUILD_STAGE_VOICE]: 'stage',
    [ChannelType.GUILD_DIRECTORY]: 'directory',
    [ChannelType.GUILD_MEDIA]: 'media',
    [ChannelType.GUILD_THREAD]: 'thread',
    [ChannelType.GUILD_INTRODUCTION]: 'introduction',
    [ChannelType.GUILD_SUGGESTION]: 'suggestion',
    [ChannelType.GUILD_POLL]: 'poll',
    [ChannelType.GUILD_GALLERY]: 'gallery',
    [ChannelType.GUILD_DOC]: 'doc',
    [ChannelType.GUILD_CONTENT]: 'content',
    [ChannelType.GUILD_COUNTING]: 'counting',
    [ChannelType.GUILD_VENT]: 'vent',
  };
  return map[type] ?? 'text';
}
