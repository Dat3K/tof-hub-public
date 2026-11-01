// Materialize ATK% clauses from the generated English game descriptions.
module.exports=function attackPercentBonuses(description) {
  const text=description.replace(/<[^>]+>/g,'');
  const scopes='all(?: elemental)?|physical|flame|fire|frost|volt|altered';
  const noun=`((?:(?:${scopes})\\s+(?:(?:ATK|attack)\\s+and\\s+)?(?:and\\s+)?)*(?:ATK|attack)(?:\\s+types)?)`;
  const values='(\\d+(?:\\.\\d+)?%(?:\\s*\\/\\s*\\d+(?:\\.\\d+)?%)*)';
  const pattern=new RegExp(noun+'\\s*(?:after[^%.]{0,80}?by\\s*|(?:is\\s+)?increased\\s+by\\s*|by\\s*|\\+\\s*)?'+values,'gi');
  return [...text.matchAll(pattern)].flatMap(match=>{
    const scope=match[1].toLowerCase();
    const prefix=text.slice(0,match.index).split(/[.!?]\s/).at(-1)||'';
    if(/(?:reduce|decrease)\s*$/i.test(prefix))return [];
    const elements=/\ball\b/.test(scope)||!/physical|flame|fire|frost|volt|altered/.test(scope)?'all':
      Object.entries({physical:'Physical',flame:'Flame',fire:'Flame',frost:'Frost',volt:'Volt',altered:'Altered'}).filter(([word])=>scope.includes(word)).map(([,element])=>element);
    const suffix=text.slice(match.index+match[0].length).split(/[.!?]\s/)[0];
    const stack=suffix.match(/stacking up to (\d+) times/i);
    const condition=/non-Benediction/i.test(prefix)?'non-benediction':/Benediction/i.test(prefix)?'benediction':undefined;
    return [{elements,values:match[2].match(/\d+(?:\.\d+)?/g).map(value=>Number(value)/100),
      ...(condition?{condition}:{}),...(/when|after|upon/i.test(prefix)||/after/i.test(match[0])||/on hit/i.test(suffix)?{conditional:true}:{}),
      ...(stack?{maxStacks:Number(stack[1])}:{})}];
  });
};
