// Portable copy of the local browser guard; runtime.mjs prefers the canonical guard when installed.
const WEBRTC_KILL = () => {
  const kill = (o, p) => { try { Object.defineProperty(o, p, { value: undefined, configurable: false }); } catch {} };
  for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection',
    'RTCIceCandidate', 'RTCSessionDescription', 'RTCDataChannel']) kill(window, k);
  try { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('WebRTC disabled')); } catch {}
};

async function disableWebRTC(context) {
  await context.addInitScript(WEBRTC_KILL);
  return context;
}

module.exports = { WEBRTC_KILL, disableWebRTC };
