// Dashboard greeting: a title ("Howl's it going, {name}?") and a subline, picked by time of
// day from a small pool of wolf puns and plain lines. Pure, so it is unit-tested and needs no
// request.
//
// The pick is deterministic: one line per (time bucket, local date), from a small hash of the
// day number. It never uses Math.random, so re-renders keep the same line and it only changes
// when the bucket or the date does. The caller passes the browser's local clock; the server
// render may sit in another time zone, so the elements showing it keep
// suppressHydrationWarning (see HeaderBand in dashboard.tsx).

export type GreetingBucket = "earlyMorning" | "morning" | "afternoon" | "evening" | "lateNight";

export interface GreetingLine {
  /** Contains `{name}` exactly once; replaced with the owner's display name. */
  title: string;
  subline: string;
}

/** Longest title template, `{name}` excluded, so the header stays short on a phone. */
export const MAX_GREETING_TITLE_CHARS = 28;
/** Longest subline (one text-sm line on a phone). */
export const MAX_GREETING_SUBLINE_CHARS = 40;

export const GREETINGS: Record<GreetingBucket, readonly GreetingLine[]> = {
  earlyMorning: [
    { title: "Up with the moon, {name}", subline: "The early wolf gets the quiet hours." },
    { title: "Rise and howl, {name}", subline: "The den is quiet. Good time to focus." },
    { title: "Early howl, {name}", subline: "First light, first task?" },
    { title: "Good morning, {name}", subline: "What's first on the list?" },
  ],
  morning: [
    { title: "Good morning, {name}", subline: "What's first on the list?" },
    { title: "Howl's it going, {name}?", subline: "Pick a task and pounce." },
    { title: "Leader of the pack today, {name}?", subline: "Set the pace for the day." },
    { title: "Morning, {name}", subline: "Fresh start, fresh list." },
  ],
  afternoon: [
    { title: "Good afternoon, {name}", subline: "Keep it going." },
    { title: "Fur real, another round, {name}?", subline: "One more session, then a stretch." },
    { title: "Paws for a break, {name}?", subline: "Stretch, sip water, then back to it." },
    { title: "Still on the hunt, {name}?", subline: "One more task to track down." },
  ],
  evening: [
    { title: "Good evening, {name}", subline: "Wrapping up the day's work?" },
    { title: "Evening, {name}", subline: "Pack it in, or one more round?" },
    { title: "Dusk patrol, {name}", subline: "Wrapping up the day's work?" },
    { title: "Howl was today, {name}?", subline: "Finish strong, then rest those paws." },
  ],
  lateNight: [
    { title: "Working late, {name}", subline: "Burning the midnight oil?" },
    { title: "Werewolf hours, {name}", subline: "Full moon, full focus." },
    { title: "Still howling, {name}?", subline: "Don't forget to rest those paws." },
    { title: "Moonlight shift, {name}", subline: "Pack it in for the night?" },
  ],
};

/** Local hour → bucket: 4–8 early morning, 8–12 morning, 12–17 afternoon, 17–21 evening, else late night. */
export function greetingBucket(hour: number): GreetingBucket {
  if (hour >= 4 && hour < 8) return "earlyMorning";
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "lateNight";
}

const BUCKET_SALT: Record<GreetingBucket, number> = {
  earlyMorning: 1,
  morning: 2,
  afternoon: 3,
  evening: 4,
  lateNight: 5,
};

/** Days since the epoch for the LOCAL calendar date (not the UTC one). */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/** The greeting for a moment: same bucket and local date → same line. */
export function pickGreeting(date: Date): GreetingLine {
  const bucket = greetingBucket(date.getHours());
  const pool = GREETINGS[bucket];
  // Multiplicative hash, then fold the high bits down (the low bits of a product only see the
  // input's low bits), so consecutive days don't just walk the pool in order.
  const product = Math.imul(localDayNumber(date) * 8 + BUCKET_SALT[bucket], 0x9e3779b1);
  const hash = (product ^ (product >>> 16)) >>> 0;
  return pool[hash % pool.length]!;
}

/** Fills `{name}` (split/join, so a `$` in a display name is never a replace pattern). */
export function formatGreeting(line: GreetingLine, name: string): GreetingLine {
  return { title: line.title.split("{name}").join(name), subline: line.subline };
}
