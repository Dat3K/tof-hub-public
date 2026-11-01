// Check the configured existing database. Never initialize, replace or seed a database here.
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const requireApi=createRequire(path.resolve(import.meta.dirname,'../../apps/api/package.json'));
const {Client}=requireApi('pg');
async function connect(){
  const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
  try{await client.connect();return client;}catch(error){await client.end().catch(()=>{});throw error;}
}
async function main(){
  const url=new URL(process.env.DATABASE_URL??'');
  if(url.hostname==='postgres')throw new Error('Use the local PostgreSQL host in DATABASE_URL; "postgres" is a Docker-only hostname.');
  let client;
  try{client=await connect();}catch(error){
    if(process.platform!=='win32'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||
      !['ECONNREFUSED','ECONNRESET'].includes(error.code))throw error;
    console.log('Starting the installed local PostgreSQL service...');
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      "$ErrorActionPreference='Stop'; $services=@(Get-Service | Where-Object { if($env:TOF_HUB_POSTGRES_SERVICE) { $_.Name -eq $env:TOF_HUB_POSTGRES_SERVICE } else { $_.Name -like 'postgresql*' } }); if($services.Count -ne 1) { throw 'Set TOF_HUB_POSTGRES_SERVICE to the installed PostgreSQL service name.' }; Start-Service -InputObject $services[0]; $services[0].WaitForStatus('Running',[TimeSpan]::FromSeconds(30))"],{stdio:'inherit',windowsHide:true});
    for(let attempt=0;attempt<10;attempt++){
      try{client=await connect();break;}catch(retry){if(attempt===9)throw retry;await new Promise(resolve=>setTimeout(resolve,500));}
    }
  }
  try{
    const {rows}=await client.query('SELECT current_database() AS name');
    console.log(`Local PostgreSQL ready: ${url.hostname}:${url.port||5432}/${rows[0].name}`);
  }finally{await client.end();}
}
main().catch(error=>{
  // pg error messages and connection URLs can expose passwords; show only a known code or our own instruction.
  console.error('Local database unavailable:',error.code??(error.constructor===Error?error.message:'connection failed'));
  console.error('Check DATABASE_URL and the existing PostgreSQL service. API was not started with an empty store.');
  process.exitCode=1;
});
