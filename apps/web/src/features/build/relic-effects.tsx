export {RelicEffects} from '../info-sections/common/relic-effects';
import {InspectionHeading,InspectionStars} from './build-inspection';

export function RelicHeading({name,stars}:{name:string;stars:number}) {
  return <InspectionHeading title={name} meta={<InspectionStars value={stars}/>}/>;
}
