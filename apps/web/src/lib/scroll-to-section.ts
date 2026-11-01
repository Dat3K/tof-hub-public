/** Align a tool section below the responsive site header. */
export function scrollToSection(section: HTMLElement | null, options: {durationMs?:number;onlyIfOutside?:boolean;block?:'start'|'center'} = {}) {
  const noop=()=>{};
  if (!section) return noop;
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  const inset = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
  const bounds=section.getBoundingClientRect();
  if(options.onlyIfOutside&&bounds.top>=inset&&bounds.bottom<=window.innerHeight)return noop;
  const target=()=>{
    const rect=section.getBoundingClientRect();
    const offset=options.block==='center'?inset+(window.innerHeight-inset-rect.height)/2:inset;
    return Math.min(Math.max(0,document.documentElement.scrollHeight-window.innerHeight),Math.max(0,window.scrollY+rect.top-offset));
  };
  const top=target();
  if(options.durationMs!==undefined) {
    const start=window.scrollY,distance=top-start;
    if(Math.abs(distance)<1)return noop;
    const started=performance.now();
    let frame=0;
    const cancel=()=>{
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel',cancel);
      window.removeEventListener('touchstart',cancel);
      window.removeEventListener('keydown',cancel);
    };
    const step=(now:number)=>{
      const progress=Math.min(1,(now-started)/Math.max(1,options.durationMs!));
      // content-visibility can refine preceding row heights while the viewport approaches the target.
      window.scrollTo({top:start+(target()-start)*(1-Math.pow(1-progress,3)),behavior:'instant'});
      if(progress<1)frame=requestAnimationFrame(step);else cancel();
    };
    window.addEventListener('wheel',cancel,{passive:true});
    window.addEventListener('touchstart',cancel,{passive:true});
    window.addEventListener('keydown',cancel);
    frame=requestAnimationFrame(step);
    return cancel;
  }
  window.scrollTo({
    top,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  return noop;
}
