// Canvg waits for native image readiness while rendering a single frame.
const frame=Object.assign((callback:(time:number)=>void)=>setTimeout(()=>callback(Date.now()),16),{
  cancel:(id:ReturnType<typeof setTimeout>)=>clearTimeout(id),
});
export default frame;
