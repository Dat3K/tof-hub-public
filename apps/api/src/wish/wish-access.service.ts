import { HttpException, Injectable, Optional,ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeIp } from './wish-query.validation';

const TOKEN_PREFIX = 'wtk_';
const MAX_TOKENS_PER_PROFILE = 20;
const MAX_IPS_PER_PROFILE = 20;
const MAX_GRANT_PROFILES=20_000;
const MAX_STORE_BYTES=64*1024*1024;

interface DeviceToken {
  hash: string;
  label: string;
  createdAt: string;
}

interface ProfileGrants {
  tokens: DeviceToken[];
  ips: string[];
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * File-backed access grants for imported wish profiles.
 * Two independent facts grant read access: a device token issued at import
 * time (survives IP changes) or a requester IP that previously imported or
 * presented a valid token (covers a second device on the same network).
 * Demo profiles are always public and are bypassed by the caller.
 */
@Injectable()
export class WishAccessService {
  private readonly storePath: string;
  private grants = new Map<string, ProfileGrants>();

  // Tests pass a path; Nest has no provider for it, so the parameter must be optional for DI.
  constructor(@Optional() storePath?: string) {
    this.storePath =
      storePath ??
      process.env.WISH_ACCESS_PATH ??
      path.resolve(process.cwd(), '.data', 'wish-access.json');
    this.load();
  }

  public hasGrants(profileId: string): boolean {
    const grants = this.grants.get(profileId);
    return Boolean(grants && (grants.tokens.length > 0 || grants.ips.length > 0));
  }

  public checkAccess(profileId: string, query: { token?: string; ip?: string }): boolean {
    const grants = this.grants.get(profileId);
    if (!grants) return false;
    if (query.token && this.findToken(grants, query.token)) {
      if (query.ip) this.rememberIp(profileId, grants, query.ip);
      return true;
    }
    if (query.ip && grants.ips.includes(normalizeIp(query.ip))) return true;
    return false;
  }

  public checkToken(profileId: string, token: string | undefined): boolean {
    const grants = this.grants.get(profileId);
    return Boolean(token && grants && this.findToken(grants, token));
  }

  /**
   * Records an importer IP. Issues the first device token when the profile
   * has no grants yet (fresh import or pre-feature profile recovery).
   * Returns the plaintext token only when a new one was issued.
   */
  public grantImporterAccess(profileId: string, ip: string): string | null {
    const grants = this.forProfile(profileId);
    this.rememberIp(profileId, grants, ip);
    if (grants.tokens.length === 0) return this.addToken(profileId, grants, 'first-import');
    return null;
  }

  public issueDeviceToken(profileId: string, label?: string): string {
    const grants = this.forProfile(profileId);
    if (grants.tokens.length >= MAX_TOKENS_PER_PROFILE) {
      throw new HttpException('Too many device tokens for this profile',429);
    }
    return this.addToken(profileId, grants, (label ?? 'device').slice(0, 64));
  }

  /** Self-revoke: the presented token is removed when it belongs to the profile. */
  public revokeToken(profileId: string, token: string | undefined): boolean {
    if (!token) return false;
    const grants = this.grants.get(profileId);
    if (!grants) return false;
    const wanted = hashToken(token);
    const before = grants.tokens.length;
    grants.tokens = grants.tokens.filter((entry) => !sameHash(entry.hash, wanted));
    if (grants.tokens.length === before) return false;
    this.save();
    return true;
  }

  public clearIps(profileId: string): void {
    const grants = this.grants.get(profileId);
    if (!grants) return;
    grants.ips = [];
    this.save();
  }

  private findToken(grants: ProfileGrants, token: string): boolean {
    if (!/^wtk_[a-f0-9]{48}$/.test(token)) return false;
    const wanted = hashToken(token);
    return grants.tokens.some((entry) => sameHash(entry.hash, wanted));
  }

  private addToken(profileId: string, grants: ProfileGrants, label: string): string {
    const token = `${TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
    grants.tokens.push({ hash: hashToken(token), label, createdAt: new Date().toISOString() });
    this.save();
    void profileId;
    return token;
  }

  private rememberIp(profileId: string, grants: ProfileGrants, ip: string): void {
    const normalized = normalizeIp(ip);
    if (normalized === 'unknown') return;
    if(grants.ips[0]===normalized)return;
    grants.ips = [normalized, ...grants.ips.filter((known) => known !== normalized)].slice(
      0,
      MAX_IPS_PER_PROFILE
    );
    this.save();
    void profileId;
  }

  private forProfile(profileId: string): ProfileGrants {
    let grants = this.grants.get(profileId);
    if (!grants) {
      if(this.grants.size>=MAX_GRANT_PROFILES)throw new ServiceUnavailableException('Wish access storage capacity reached');
      grants = { tokens: [], ips: [] };
      this.grants.set(profileId, grants);
    }
    return grants;
  }

  private load(): void {
    if (!fs.existsSync(this.storePath)) return;
    if(fs.statSync(this.storePath).size>MAX_STORE_BYTES)throw new Error('Wish access store exceeds safety limit');
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as unknown;
    } catch {
      throw new Error(`Wish access store is unreadable: ${this.storePath}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Wish access store has an unexpected shape: ${this.storePath}`);
    }
    for (const [profileId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!/^import-[a-f0-9]{32}$/.test(profileId) || !value || typeof value !== 'object') continue;
      const record = value as { tokens?: unknown; ips?: unknown };
      const tokens = Array.isArray(record.tokens)
        ? record.tokens.filter(
            (entry): entry is DeviceToken =>
              Boolean(entry) &&
              typeof entry === 'object' &&
              typeof (entry as DeviceToken).hash === 'string' &&
              typeof (entry as DeviceToken).label === 'string'
          )
        : [];
      const ips = Array.isArray(record.ips)
        ? record.ips.filter((entry): entry is string => typeof entry === 'string')
        : [];
      if(this.grants.size>=MAX_GRANT_PROFILES)throw new Error('Wish access store exceeds profile limit');
      this.grants.set(profileId, { tokens: tokens.slice(0, MAX_TOKENS_PER_PROFILE), ips: ips.slice(0, MAX_IPS_PER_PROFILE) });
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    const tmp = `${this.storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.grants), null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.storePath);
  }
}
