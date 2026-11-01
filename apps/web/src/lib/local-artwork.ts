/** User images stay on this device. Never persist a session-only blob URL or send the file to the server. */
const DATABASE='tof-hub-local-artwork';
const STORE='images';
const settingsKey=(key:string)=>`${DATABASE}:${key}:settings`;
let writes:Promise<unknown>=Promise.resolve();

async function access<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T> {
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  try {
    return await new Promise<T>((resolve,reject)=>{
      const transaction=database.transaction(STORE,mode);
      const request=run(transaction.objectStore(STORE));
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error);
    });
  } finally {database.close();}
}

export async function loadLocalArtwork<T>(key:string):Promise<{file:Blob;settings:T}|null> {
  await writes.catch(()=>{});
  const file=await access('readonly',store=>store.get(key));
  const settings=localStorage.getItem(settingsKey(key));
  if(!(file instanceof Blob)||!settings)return null;
  return {file,settings:JSON.parse(settings) as T};
}

export function saveLocalArtworkSettings<T>(key:string,settings:T):void {
  localStorage.setItem(settingsKey(key),JSON.stringify(settings));
}

export function saveLocalArtwork<T>(key:string,file:Blob,settings:T):Promise<void> {
  const next=writes.catch(()=>{}).then(async()=>{
    await access('readwrite',store=>store.put(file,key));
    saveLocalArtworkSettings(key,settings);
  });
  writes=next;
  return next;
}

export async function removeLocalArtwork(key:string):Promise<void> {
  localStorage.removeItem(settingsKey(key));
  const next=writes.catch(()=>{}).then(async()=>{await access('readwrite',store=>store.delete(key));localStorage.removeItem(settingsKey(key));});
  writes=next;
  return next;
}
