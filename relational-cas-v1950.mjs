// A shared, fail-closed concurrency guard for canonical relational data.
// Works without schema changes. Legacy devices that lack a baseline cannot overwrite.
export const SYNC_STAMP='_relSyncUpdatedAtV1950';
export const SYNC_BASE='_relSyncFingerprintV1950';
export function stripRelSyncMetadataV1950(record) {
 const data=JSON.parse(JSON.stringify(record??{}));
 delete data[SYNC_STAMP];delete data[SYNC_BASE];
 return data;
}
export function tagHydratedRowV1950(local,remote,stringify) {
 if(!local||!remote)throw Error('Snapshot relacional inválido.');
 local[SYNC_STAMP]=remote.updated_at??null;
 local[SYNC_BASE]=stringify(stripRelSyncMetadataV1950(local));
 return local;
}
export function planRelationalWriteV1950(local,remote,stringify) {
 if(!local)throw Error('Registo relacional inválido.');
 const current=stringify(stripRelSyncMetadataV1950(local));
 const base=local[SYNC_BASE];
 if(!remote)return base===undefined?{action:'insert'}:{action:'conflict',reason:'deleted_remote'};
 const remoteData=stripRelSyncMetadataV1950(remote.data??{});remoteData._rid=remote.id;
 const remoteSame=current===stringify(remoteData);
 if(base===undefined)return remoteSame?{action:'adopt'}:{action:'conflict',reason:'missing_baseline'};
 if(base===current)return {action:'skip'};
 if(remoteSame)return {action:'adopt'};
 if((local[SYNC_STAMP]??null)!==(remote.updated_at??null))return {action:'conflict',reason:'remote_changed'};
 return {action:'update'};
}
export async function writeRelationalRowsCasV1950({client,table,rows,remoteRows,localRows,userId,stringify,onAck}) {
 if(!client||!table||!userId||!Array.isArray(rows)||!Array.isArray(remoteRows)||!Array.isArray(localRows))throw Error('Sincronização relacional sem contexto.');
 const remotes=new Map(remoteRows.map(r=>[r.id,r])),locals=new Map(localRows.map(r=>[r._rid,r]));
 const counts={inserted:0,updated:0,skipped:0,adopted:0};
 for(const row of rows) {
  const local=locals.get(row.id),remote=remotes.get(row.id);
  if(!local)throw Error('Registo local sem identidade: '+row.id);
  const plan=planRelationalWriteV1950(local,remote,stringify);
  if(plan.action==='conflict')throw Error('CONFLITO_RELACIONAL_V1950: '+table+' '+row.id+' ('+plan.reason+'). Atualiza a Cloud e revê o registo.');
  if(plan.action==='skip'){counts.skipped++;continue;}
  if(plan.action==='adopt'){tagHydratedRowV1950(local,remote,stringify);onAck?.();counts.adopted++;continue;}
  const query=plan.action==='insert'
   ?client.from(table).insert(row)
   :client.from(table).update(row).eq('id',row.id).eq('user_id',userId);
  const guarded=plan.action==='update'
   ?(remote.updated_at==null?query.is('updated_at',null):query.eq('updated_at',remote.updated_at))
   :query;
  const {data:saved,error}=await guarded.select('id,updated_at').maybeSingle();
  if(error)throw error;
  if(!saved||saved.id!==row.id)throw Error('CONFLITO_RELACIONAL_V1950: escrita não confirmada '+table+' '+row.id);
  local[SYNC_STAMP]=saved.updated_at??null;
  local[SYNC_BASE]=stringify(stripRelSyncMetadataV1950(row.data));
  onAck?.();
  counts[plan.action==='insert'?'inserted':'updated']++;
 }
 return counts;
}
