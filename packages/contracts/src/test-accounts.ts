/** Observations of the same UID on test clients, independent of its live profile. */
export interface TestServerParticipation {
  distribution:string;
  firstSeenAt:string|null;
  lastSeenAt:string|null;
  firstTimeSource?:'observation'|'scan'|'import';
  lastTimeSource?:'observation'|'scan'|'import';
}
