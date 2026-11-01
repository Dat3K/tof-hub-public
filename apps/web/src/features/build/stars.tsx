export function Stars({value}:{value:number}) {
  return <span className="stars" aria-label={`${value} ★`}>{value?'★'.repeat(value):'0 ★'}</span>;
}
