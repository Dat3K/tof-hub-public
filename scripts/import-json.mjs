import fs from 'node:fs';
import path from 'node:path';

const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const kind=option('--kind'),file=option('--file');
const endpoints={build:'/build/import',wish:'/wish/import/jobs',players:'/ranking/inspect',profile:'/build/profiles','mmo-profile':'/build/mmo-profiles'};
if(!file||!endpoints[kind])throw new Error('Usage: node scripts/import-json.mjs --kind build|wish|players|profile|mmo-profile --file FILE [--origin http://localhost:8080]');
const origin=(option('--origin')??'http://localhost:8080').replace(/\/$/,'');
const read=async(url,init)=>{
 const response=await fetch(origin+'/api/v1'+url,init);
 const data=await response.json();
 if(!response.ok)throw new Error('HTTP '+response.status+': '+JSON.stringify(data));
 return data;
};
let job=await read(endpoints[kind],{method:'POST',headers:{'Content-Type':kind==='players'?'application/octet-stream':'application/json'},body:fs.readFileSync(file,'utf8')});
const id=job.id;if(typeof id!=='string')throw new Error('Server did not return a queue job');
const deadline=Date.now()+180000;
while(job.state!=='complete'&&job.state!=='failed'){
 if(Date.now()>deadline)throw new Error('Timed out waiting for job '+id);
 await new Promise(resolve=>setTimeout(resolve,1500));
 job=await read('/queue/jobs/'+encodeURIComponent(id));
}
if(job.state==='failed')throw new Error('Job failed: '+JSON.stringify(job.error));
const result=job.deliveryAvailable?await read('/queue/jobs/'+encodeURIComponent(id)+'/delivery'):job.result;
const target=path.resolve(option('--out')??'ignore/import-results/'+kind+'.json');
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,JSON.stringify({jobId:id,result},null,2)+'\n',{mode:0o600});
if(kind==='build'&&result?.data&&result?.source?.signature){
 const mode=result.data.mmo?{mode:'mmo',role:'dps'}:{role:'dps',element:'Frost'};
 const save={capture:result.data,digest:result.source.digest,signature:result.source.signature,...mode};
 fs.writeFileSync(path.join(path.dirname(target),'build-profile.json'),JSON.stringify(save,null,2)+'\n',{mode:0o600});
}
console.log('Import complete. Private result saved to '+target+'.');
