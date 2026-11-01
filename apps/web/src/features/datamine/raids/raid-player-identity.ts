import type {RaidRankingMember} from '@tof-hub/game-domain';

export const raidPlayerKey = (member: RaidRankingMember) => member.identifier ? `role:${member.identifier}` : member.observationId ? `observation:${member.observationId}` : `name:${member.nickname}`;
