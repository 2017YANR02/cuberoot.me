/**
 * The two CRC-16 variants the QiYi / GAN devices use. Shared by both sides of
 * this directory: the QiYi smart CUBE (`./qiyi.ts`) and the QiYi smart TIMER
 * (`./timer/qiyi_timer.ts`) checksum their messages the same way, and the GAN
 * timer uses the CCITT variant.
 *
 *   CRC-16/CCITT-FALSE  — GAN Smart Timer frame checksum.
 *       width=16 poly=0x1021 init=0xFFFF refin=false refout=false xorout=0x0000
 *       check("123456789") = 0x29B1
 *
 *   CRC-16/MODBUS       — QiYi Timer message checksum.
 *       width=16 poly=0x8005 (reflected 0xA001) init=0xFFFF refin=true
 *       refout=true xorout=0x0000
 *       check("123456789") = 0x4B37
 *
 * csTimer's implementations (gantimer.js:51-61, qiyitimer.js:31-40) omit the
 * per-iteration `& 0xFFFF` mask and only mask the final result. That is
 * arithmetically equivalent — the bits that escape above bit 15 can never feed
 * back into the low 16 bits through `<<`, `^ 0x1021` or `^ (byte << 8)` — but
 * it lets the accumulator grow past 2^31 and rely on JS's 32-bit wraparound.
 * We mask every iteration instead, which is the textbook formulation and
 * produces identical output.
 */

/** CRC-16/CCITT-FALSE over `data`. */
export function crc16CcittFalse(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      crc = ((crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

/** CRC-16/MODBUS over `data`. */
export function crc16Modbus(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc & 0xffff;
}
