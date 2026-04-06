import * as dotenv from 'dotenv';
dotenv.config();

import { runSqlFile } from './_run-sql-file';
import { probeParkingAppGrants } from './_probe-parking-app-grants';

function isGrantCapabilityError(err: any): boolean {
  const code = String(err?.code ?? '').trim();
  return [
    'ER_DBACCESS_DENIED_ERROR',
    'ER_CANT_CREATE_USER_WITH_GRANT',
    'ER_SPECIFIC_ACCESS_DENIED_ERROR',
  ].includes(code);
}

function envFlag(name: string, fallback = false): boolean {
  const raw = (process.env[name] ?? '').trim().toUpperCase();
  if (!raw) return fallback;
  return ['1', 'ON', 'TRUE', 'YES'].includes(raw);
}

function runtimeAdminFallbackEnabled(): boolean {
  const devDefault = process.env.NODE_ENV === 'production' ? false : true;
  return envFlag('DB_RUNTIME_FALLBACK_TO_ADMIN', devDefault);
}

function grantGuidance(err: any, probe?: Awaited<ReturnType<typeof probeParkingAppGrants>>): string {
  const probeLine = probe
    ? `appUser=${probe.currentUser ?? '(unknown)'} appGrantProbe=${probe.ok ? 'OK' : 'MISSING'}`
    : 'appGrantProbe=UNKNOWN';
  const missing = probe && !probe.ok && probe.missing.length > 0 ? `\nMissing app privileges:\n- ${probe.missing.join('\n- ')}` : '';
  const runtimeFallback = runtimeAdminFallbackEnabled()
    ? '\nRuntime note: DB_RUNTIME_FALLBACK_TO_ADMIN is active, so local dev server/scripts can keep running with admin DB creds even if parking_app is still under-granted.'
    : '';
  return (
    `Database admin user cannot run GRANT on parking_mgmt.*. ${probeLine}${missing}${runtimeFallback}\n` +
    `Fix at MySQL server level: run apps/api/db/scripts/bootstrap.sql once using real MySQL root/system admin, ` +
    `or manually grant WITH GRANT OPTION to the current parking_root host account.\n` +
    `Current SQL error: ${String(err?.message ?? err)}`
  );
}

export type ParkingAppGrantProfile = 'DEVLOG' | 'MVP';

function normalizeGrantProfile(value: unknown): ParkingAppGrantProfile {
  return String(value ?? '').trim().toUpperCase() === 'MVP' ? 'MVP' : 'DEVLOG';
}

function resolveGrantFile(profile: ParkingAppGrantProfile): string {
  return profile === 'MVP' ? 'db/scripts/grants_parking_app.mvp.sql' : 'db/scripts/grants_parking_app.devlog.sql';
}

export async function applyParkingAppGrants(options?: { profile?: ParkingAppGrantProfile | string | null }) {
  const profile = normalizeGrantProfile(options?.profile ?? process.env.PARKLY_APP_PROFILE ?? 'DEVLOG');
  const file = resolveGrantFile(profile);

  console.log(`[grants] profile=${profile} file=${file}`);

  try {
    await runSqlFile(file, { useAdmin: true });
    return { profile, file };
  } catch (err: any) {
    if (!isGrantCapabilityError(err)) throw err;

    let probe: Awaited<ReturnType<typeof probeParkingAppGrants>> | undefined;
    try {
      probe = await probeParkingAppGrants();
    } catch (probeErr: any) {
      if (runtimeAdminFallbackEnabled() && !envFlag('DB_GRANT_STRICT', false)) {
        console.warn('[grants] WARN: admin user cannot GRANT and parking_app probe failed, but runtime admin fallback is ON. Continuing for local dev.');
        console.warn(`[grants] WARN: ${String(probeErr?.message ?? probeErr)}`);
        console.warn(`[grants] WARN: ${grantGuidance(err)}`);
        return;
      }
      throw new Error(
        grantGuidance(err) +
          `\nAdditionally, parking_app probe failed: ${String(probeErr?.message ?? probeErr)}`
      );
    }

    const strict = envFlag('DB_GRANT_STRICT', false);
    if ((!strict && probe.ok) || (!strict && runtimeAdminFallbackEnabled())) {
      const reason = probe.ok
        ? 'parking_app already appears to have required privileges'
        : 'runtime admin fallback is ON for local dev';
      console.warn(`[grants] WARN: admin user cannot GRANT, but ${reason}. Skipping hard failure.`);
      console.warn(`[grants] WARN: ${grantGuidance(err, probe)}`);
      return;
    }

    throw new Error(grantGuidance(err, probe));
  }
}

async function main() {
  await applyParkingAppGrants();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
