import type {PrismaClient} from '@prisma/client';

/** No imported field should ever reach SQL syntax; an independent role boundary also forbids destructive DDL. */
export async function assertRuntimeDatabaseRole(prisma:PrismaClient):Promise<void> {
  const rows=await prisma.$queryRaw<{unsafe:boolean}[]>`
    SELECT (
      EXISTS (SELECT 1 FROM pg_roles r WHERE pg_has_role(current_user,r.oid,'MEMBER')
        AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
          OR r.rolname IN ('pg_write_server_files','pg_read_server_files','pg_execute_server_program','pg_signal_backend')))
      OR EXISTS (SELECT 1 FROM pg_database d
        WHERE pg_has_role(current_user,d.datdba,'MEMBER')
          OR (d.datname=current_database() AND has_database_privilege(d.oid,'CREATE')))
      OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
        AND (pg_has_role(current_user,n.nspowner,'MEMBER') OR has_schema_privilege(n.oid,'CREATE')))
      OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
          AND (pg_has_role(current_user,c.relowner,'MEMBER')
            OR (c.relkind IN ('r','p') AND has_table_privilege(c.oid,'TRUNCATE,TRIGGER'))))
    ) AS unsafe`;
  if(rows.length!==1||rows[0]!.unsafe!==false)throw new Error('Unsafe production database role: use a separate runtime login without ownership, elevated role memberships, CREATE, TRUNCATE or TRIGGER privileges');
}
