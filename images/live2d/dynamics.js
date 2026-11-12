/* Secondary motion for the native ear, tail and hair bindings; no facial parameters. */
((root,factory)=>{
  const value=factory();
  if(typeof module==='object'&&module.exports)module.exports=value;
  else root.IchigooriDynamics=value;
})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const TAU=Math.PI*2,clamp=v=>Math.max(-1,Math.min(1,v));
  const wave=(time,period,phase=0)=>Math.sin(TAU*time/period+phase);
  const ids=['ParamEarL','ParamEarR','ParamTailSway','ParamTailTip','ParamWindBackL','ParamWindBackR','ParamWindFrontL','ParamWindFrontR','ParamWindBangs','ParamWindAhoge'];
  function twitch(time,offset){
    const age=((time-offset)%12+12)%12;
    return age<.7?.14*Math.sin(age*Math.PI/.7)**2*Math.sin(TAU*age*3.5):0;
  }
  function ambient(time){
    return {
      ParamEarL:.07*wave(time,12,.2)+.025*wave(time,6,.6)+twitch(time,4.1),
      ParamEarR:.065*wave(time,12,1.1)+.025*wave(time,6,1.8)+twitch(time,8.3),
      ParamTailSway:.18*wave(time,6)+.045*wave(time,12,.3),
      ParamTailTip:.18*wave(time,6,-.65)+.055*wave(time,4,.4),
      ParamWindBackL:.24*wave(time,6)+.055*wave(time,4,.4),
      ParamWindBackR:.22*wave(time,6,-.75)+.05*wave(time,4,-.3),
      ParamWindFrontL:.25*wave(time,6,-.45)+.045*wave(time,4,.8),
      ParamWindFrontR:.23*wave(time,6,-1.2)+.05*wave(time,4,.15),
      ParamWindBangs:.12*wave(time,6,-.2)+.025*wave(time,3,.8),
      ParamWindAhoge:.2*wave(time,4,-.4)+.035*wave(time,3,.6)
    };
  }
  function reaction(age){
    const out={ParamEarL:0,ParamEarR:0,ParamTailSway:0,ParamTailTip:0};
    if(age<0||age>=3.3)return out;
    const rise=Math.min(1,age/.055),fade=Math.max(0,1-(age/3.3)**4);
    out.ParamEarL=.90*rise*fade*Math.exp(-age/.72)*Math.sin(TAU*4.8*age+.65);
    out.ParamEarR=-.85*rise*fade*Math.exp(-age/.78)*Math.sin(TAU*4.5*age-.15);
    out.ParamTailSway=.76*rise*fade*Math.exp(-age/1.1)*Math.sin(TAU*1.8*age+.35);
    out.ParamTailTip=.82*rise*fade*Math.exp(-age/1.25)*Math.sin(TAU*1.8*age-.5);
    return out;
  }
  function sample(time,petAge=-1){
    const values=ambient(time),extra=reaction(petAge);
    for(const id of Object.keys(extra))values[id]=clamp(values[id]+extra[id]);
    return values;
  }
  function createDriver(){
    let elapsed=0,lastPet=-Infinity;
    return {
      advance(delta){elapsed+=Math.max(0,Math.min(.06,Number.isFinite(delta)?delta:0));return sample(elapsed,elapsed-lastPet);},
      pet(){if(elapsed-lastPet<.25)return false;lastPet=elapsed;return true;}
    };
  }
  return {ids,ambient,reaction,sample,createDriver};
});
