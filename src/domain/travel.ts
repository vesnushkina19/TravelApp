export type Role = 'organizer' | 'member';

export type Participant = {
  id: string;
  name: string;
  role: Role;
  isMe?: boolean;
};

export type StopKind = 'sight' | 'food' | 'transport' | 'stay' | 'walk' | 'nature';

export const StopKindIcons: Record<StopKind, string> = {
  sight: '🏛️',
  food: '🍽️',
  transport: '🚐',
  stay: '🏨',
  walk: '🚶',
  nature: '⛰️',
};

export type Stop = {
  id: string;
  time: string;
  title: string;
  kind: StopKind;
  /** Предполагаемая длительность, свободный текст. */
  duration: string;
  note?: string;
};

export type TripDay = {
  date: string;
  stops: Stop[];
};
