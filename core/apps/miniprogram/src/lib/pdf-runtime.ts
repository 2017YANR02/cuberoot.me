import {miniProgramApi} from './platform';

// jsPDF's browser bundle needs base64 helpers, not a browser global. The build
// binds this object only inside jsPDF; it never adds window/document to the app.
export const pdfEnvironment = {
  console,
  atob(value:string) {
    const bytes=new Uint8Array(miniProgramApi().base64ToArrayBuffer(value));let result='';
    for(let i=0;i<bytes.length;i+=8192) result+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return result;
  },
  btoa(value:string) {
    return miniProgramApi().arrayBufferToBase64(Uint8Array.from(value,c=>c.charCodeAt(0)).buffer);
  },
};
