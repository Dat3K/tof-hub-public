export type HubSectionId = 'info' | 'datamine' | 'tools';

export interface HubCardConfig {
  readonly id: HubSectionId;
  readonly href: string;
}

export interface HubCardData {
  readonly id: HubSectionId;
  readonly href: string;
  readonly code: string;
  readonly badge: string;
  readonly title: string;
  readonly description: string;
  readonly actionText: string;
}
