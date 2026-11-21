// Memory is deliberately separate between Rust and OpenCV. Copies are explicit
// and views are reacquired after WASM growth. No JSON crosses the numeric ABI.
export async function loadCpuFitter(bytes, fixtureBytes, cv, options = {}) {
  let e;
  const instance = await WebAssembly.instantiate(bytes, { env: {
    pose_diagnostic(pointer,length) {
      const message=new TextDecoder().decode(new Uint8Array(e.memory.buffer,pointer>>>0,length>>>0));
      options.onDiagnostic?.(message);console.error(message);
    },
    pose_cv(mode, objects, pixels, count, intrinsic, distortion, distortionCount, guess, output, capacity) {
      const sizes = [count*3, pixels ? count*2 : 0, 9, distortionCount, 6, capacity];
      const total = sizes.reduce((a,b)=>a+b,0), base = cv._malloc(total*8)>>>0;
      const pointers = []; let offset=0;
      for (let i=0;i<sizes.length;i++) {pointers.push(base+offset*8);offset+=sizes[i];}
      try {
        const inputs = [objects,pixels,intrinsic,distortion,guess].map(pointer=>pointer>>>0);
        for(let i=0;i<inputs.length;i++) if(sizes[i]) cv.HEAPF64.set(new Float64Array(e.memory.buffer,inputs[i],sizes[i]),pointers[i]/8);
        const n=cv._pose_cv(mode,pointers[0],pixels?pointers[1]:0,count,pointers[2],pointers[3],distortionCount,pointers[4],pointers[5],capacity);
        if(n>=0) {
          const written=n*(mode===5?2:6);
          new Float64Array(e.memory.buffer,output>>>0,written).set(cv.HEAPF64.subarray(pointers[5]/8,pointers[5]/8+written));
        }
        return n;
      } finally {cv._free(base);}
    }
  }});
  e=instance.instance.exports;
  const call=(name,value)=>{
    // WASM i32 results are signed in JavaScript; memory32 addresses are u32.
    const input=new TextEncoder().encode(JSON.stringify(value)),pointer=e.alloc(input.length)>>>0;
    new Uint8Array(e.memory.buffer,pointer,input.length).set(input);
    let packed;
    try {packed=e[name](pointer,input.length);}finally{e.dealloc(pointer,input.length);}
    // An i64 result also arrives signed. Mask before extracting its pointer.
    const ptr=Number((packed>>32n)&0xffffffffn),len=Number(packed&0xffffffffn);
    try{return JSON.parse(new TextDecoder().decode(new Uint8Array(e.memory.buffer,ptr,len)));}
    finally{e.dealloc(ptr,len);}
  };
  const ptr=e.alloc(fixtureBytes.length)>>>0;
  new Uint8Array(e.memory.buffer,ptr,fixtureBytes.length).set(fixtureBytes);
  try{if(e.load_fixtures(ptr,fixtureBytes.length)<0)throw new Error('Invalid geometry fixture');}
  finally{e.dealloc(ptr,fixtureBytes.length);}
  return {call,get memoryBytes(){return e.memory.buffer.byteLength;}};
}
