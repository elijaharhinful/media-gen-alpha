// Unique colors for @mentions — each index gets a consistent color
export const MENTION_COLORS = [
  "#a78bfa", // purple  — 1
  "#34d399", // emerald — 2
  "#fb923c", // orange  — 3
  "#60a5fa", // blue    — 4
  "#f472b6", // pink    — 5
  "#facc15", // yellow  — 6
  "#2dd4bf", // teal    — 7
  "#f87171", // red     — 8
  "#c084fc", // violet  — 9
];

export type MentionType = "image" | "video" | "audio";

/** Returns the color for a 1-based index */
export function getMentionColor(index: number): string {
  return MENTION_COLORS[(index - 1) % MENTION_COLORS.length];
}

/**
 * Parse a prompt string and return segments with mention metadata.
 * e.g. "@image1 shows a cat" → [{ type:'mention', mentionType:'image', index:1, color:'#a78bfa', raw:'@image1' }, ...]
 */
export type Segment =
  | { type: "text"; value: string }
  | {
      type: "mention";
      raw: string;
      mentionType: MentionType;
      index: number;
      color: string;
    };

export function parsePromptSegments(text: string): Segment[] {
  const regex = /@(image|video|audio)(\d+)/gi;
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }
    const mentionType = match[1].toLowerCase() as MentionType;
    const index = parseInt(match[2], 10);
    segments.push({
      type: "mention",
      raw: match[0],
      mentionType,
      index,
      color: getMentionColor(index),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
