const fs=require('node:fs');
const path=require('node:path');
const {publicDir}=require('../lib/site-paths.cjs');
const sources=[
 {id:'live-global',label:'Global Live',branch:'OBPC_2_5',sourceUrl:'https://htkrydpatch1.wmupd.com/clientRes/OBPC_2_5/Version/Windows/config.xml'},
 {id:'cn-live',label:'China Live',branch:'',sourceUrl:'https://htcdn2.wmupd.com/hd/htob/launcher/Version.ini',launcher:{appId:'1256',resourceBases:['https://htcdn2.wmupd.com/clientRes','https://htcdn1.wmupd.com/clientRes'],versionUrls:['https://htcdn2.wmupd.com/hd/htob/launcher/Version.ini']}}
];
const buildTracker=()=>({schemaVersion:1,mode:'archive',branches:sources.map(source=>({...source,group:'live',version:null,changedAt:null,checkedAt:null,attemptedAt:null,error:false,history:[]}))});
if(require.main===module){fs.mkdirSync(path.join(publicDir,'game-data'),{recursive:true});fs.writeFileSync(path.join(publicDir,'game-data/version-tracker.json'),JSON.stringify(buildTracker(),null,2)+'\n');}
module.exports={buildTracker};
