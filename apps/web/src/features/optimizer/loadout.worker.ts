import {optimizeLoadout} from './model';
import type {LoadoutRequest,LoadoutResponse} from './use-loadout-potential';

self.onmessage=(event:MessageEvent<LoadoutRequest>)=>{
  const {pieces,draft,catalog,target,options}=event.data;
  try {self.postMessage({result:optimizeLoadout(pieces,draft,catalog,target,options)} satisfies LoadoutResponse);}
  catch {self.postMessage({error:true} satisfies LoadoutResponse);}
};
