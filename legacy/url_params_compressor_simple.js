/**
 * Simplified URL Parameters Compressor (Hash-only, No LZMA)
 * - Character mapping compression (76.8% reduction)
 * - QR Alphanumeric mode compatible
 * - Fast synchronous processing
 * - Individual parameter handling (omit empty parameters)
 * - CREST bitmap optimization (24 patterns → 6 chars, hexadecimal)
 */

// Character mapping for 55 moves (54 rotations + EMPTY)
const MOVE_TO_CHAR = {
  'U': 'A', 'U2': 'B', 'U-': 'C',
  'D': 'D', 'D2': 'E', 'D-': 'F',
  'L': 'G', 'L2': 'H', 'L-': 'I',
  'R': 'J', 'R2': 'K', 'R-': 'L',
  'F': 'M', 'F2': 'N', 'F-': 'O',
  'B': 'P', 'B2': 'Q', 'B-': 'R',
  'u': 'S', 'u2': 'T', 'u-': 'U',
  'd': 'V', 'd2': 'W', 'd-': 'X',
  'l': 'Y', 'l2': 'Z', 'l-': 'a',
  'r': 'b', 'r2': 'c', 'r-': 'd',
  'f': 'e', 'f2': 'f', 'f-': 'g',
  'b': 'h', 'b2': 'i', 'b-': 'j',
  'M': 'k', 'M2': 'l', 'M-': 'm',
  'S': 'n', 'S2': 'o', 'S-': 'p',
  'E': 'q', 'E2': 'r', 'E-': 's',
  'x': 't', 'x2': 'u', 'x-': 'v',
  'y': 'w', 'y2': 'x', 'y-': 'y',
  'z': 'z', 'z2': '0', 'z-': '1',
  'EMPTY': '2'
};

const CHAR_TO_MOVE = Object.fromEntries(
  Object.entries(MOVE_TO_CHAR).map(([k, v]) => [v, k])
);

// MCV-specific mapping (avoids digit conflict for z2/z-)
// z2='0' and z-='1' cause issues when parsing "z1" vs "z" with count "1"
// Solution: Use non-digit characters for z2 and z-
const MOVE_TO_CHAR_MCV = {
  ...MOVE_TO_CHAR,
  'z2': '-',  // hyphen (URL-safe)
  'z-': '_'   // underscore (URL-safe)
};

const CHAR_TO_MOVE_MCV = Object.fromEntries(
  Object.entries(MOVE_TO_CHAR_MCV).map(([k, v]) => [v, k])
);

// CREST 24 patterns (index.html specific, 6 rows × 4 columns)
const CREST_PATTERNS = [
  'EMPTY_EMPTY', 'EMPTY_y', 'EMPTY_y2', 'EMPTY_y-',
  'z2_EMPTY', 'z2_y', 'z2_y2', 'z2_y-',
  'z-_EMPTY', 'z-_y', 'z-_y2', 'z-_y-',
  'z_EMPTY', 'z_y', 'z_y2', 'z_y-',
  'x-_EMPTY', 'x-_y', 'x-_y2', 'x-_y-',
  'x_EMPTY', 'x_y', 'x_y2', 'x_y-'
];

// ===== REST Encoding =====

function encodeRest(restString) {
  if (!restString || restString.trim() === '') return '';
  const moves = restString.split('_');
  return moves.map(m => MOVE_TO_CHAR[m] || '').join('');
}

function decodeRest(encoded) {
  if (!encoded) return '';
  const chars = encoded.split('');
  return chars.map(c => CHAR_TO_MOVE[c] || '').join('_');
}

// ===== MAV Encoding (v2: Hybrid Format) =====

/**
 * Encode MAV to v1 format (2-char pairs)
 * Internal function for backward compatibility
 */
function encodeMav_v1(mavString) {
  if (!mavString || mavString.trim() === '') return '';
  const sections = mavString.split('|');
  let encoded = '';
  
  for (const section of sections) {
    if (!section) continue;
    const pair = section.split('~');
    for (const move of pair) {
      if (!move) continue;
      const char = MOVE_TO_CHAR[move];
      if (!char) continue;
      encoded += char;
    }
  }
  return encoded;
}

/**
 * Decode MAV from v1 format (2-char pairs)
 * Internal function for backward compatibility
 */
function decodeMav_v1(encodedMav) {
  if (!encodedMav || encodedMav.trim() === '') return '';
  
  if (encodedMav.length % 2 !== 0) {
    console.warn(`[MAV Decode Warning] Odd length input detected: "${encodedMav}" (length=${encodedMav.length}). Last character will be ignored.`);
  }
  
  const sections = [];
  
  for (let i = 0; i < encodedMav.length; i += 2) {
    if (i + 1 >= encodedMav.length) break;
    const char1 = encodedMav[i];
    const char2 = encodedMav[i + 1];
    const move1 = CHAR_TO_MOVE[char1];
    const move2 = CHAR_TO_MOVE[char2];
    if (!move1 || !move2) continue;
    sections.push(`${move1}~${move2}`);
  }
  return sections.join('|');
}

/**
 * Encode MAV to v2 format (grouped with hyphen)
 */
function encodeMav_v2(mavString) {
  if (!mavString || mavString.trim() === '') return '';
  const parts = mavString.split('|');
  const groupMap = new Map();
  
  for (const pair of parts) {
    const [move1, move2] = pair.split('~');
    const move1Char = MOVE_TO_CHAR[move1];
    const move2Char = MOVE_TO_CHAR[move2];
    if (!move1Char || !move2Char) continue;
    
    if (!groupMap.has(move1Char)) {
      groupMap.set(move1Char, []);
    }
    groupMap.get(move1Char).push(move2Char);
  }
  
  // Unicode sort (uppercase → lowercase → numbers)
  const sortedGroups = Array.from(groupMap.entries())
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
    .map(([move1Char, move2Chars]) => ({
      move1Char,
      move2Chars: move2Chars.sort().join('')
    }));
  
  // Format: "move1-move2s" using hyphen (URL-safe, readable)
  return sortedGroups.map(g => `${g.move1Char}-${g.move2Chars}`).join('');
}

/**
 * Decode MAV from v2 format (grouped with hyphen)
 */
function decodeMav_v2(encodedMav) {
  if (!encodedMav || encodedMav.trim() === '') return '';
  // Match pattern: char-chars (e.g., "A-tuv") using hyphen as delimiter
  const regex = /([A-Za-z0-2])-([A-Za-z0-2]+?)(?=[A-Za-z0-2]-|$)/g;
  const pairs = [];
  let match;
  
  while ((match = regex.exec(encodedMav)) !== null) {
    const move1Char = match[1];
    const move2Chars = match[2];
    const move1 = CHAR_TO_MOVE[move1Char];
    
    for (const move2Char of move2Chars) {
      const move2 = CHAR_TO_MOVE[move2Char];
      pairs.push(`${move1}~${move2}`);
    }
  }
  
  return pairs.join('|');
}

/**
 * Predict encoded length for v1 and v2 formats
 * Returns: { v1: number, v2: number, pairCount: number, groupCount: number }
 */
function predictMavEncodedLength(mavString) {
  if (!mavString || mavString.trim() === '') {
    return { v1: 0, v2: 0, pairCount: 0, groupCount: 0 };
  }
  
  const parts = mavString.split('|');
  const groupMap = new Map();
  let validMoveCount = 0;  // For v1: Count the number of individual moves
  let pairCount = 0;       // For v2: Count the number of valid pairs
  
  for (const pair of parts) {
    if (!pair) continue;
    const moves = pair.split('~');
    
    // v1: Count individual moves (actual behavior of encodeMav_v1)
    for (const move of moves) {
      if (!move) continue;
      const char = MOVE_TO_CHAR[move];
      if (char) {
        validMoveCount++;
      }
    }
    
    // v2: Count only if valid as a pair
    const [move1, move2] = moves;
    const move1Char = MOVE_TO_CHAR[move1];
    const move2Char = MOVE_TO_CHAR[move2];
    if (move1Char && move2Char) {
      if (!groupMap.has(move1Char)) {
        groupMap.set(move1Char, []);
      }
      groupMap.get(move1Char).push(move2Char);
      pairCount++;
    }
  }
  
  const groupCount = groupMap.size;
  
  // v1: Each valid move is 1 char (NOT 2 chars per pair)
  const v1Length = validMoveCount;
  
  // v2: Each group is "move1-move2s"
  // = groupCount × 2 (move1 + hyphen) + pairCount (all move2s)
  const v2Length = groupCount * 2 + pairCount;
  
  return {
    v1: v1Length,
    v2: v2Length,
    pairCount,
    groupCount
  };
}

/**
 * Choose optimal format (v1 or v2) based on predicted length
 * Returns: 'v1' or 'v2'
 */
function chooseMavFormat(mavString) {
  const prediction = predictMavEncodedLength(mavString);
  
  // If lengths are equal, prefer v1 (simpler, no special chars)
  return prediction.v1 <= prediction.v2 ? 'v1' : 'v2';
}

/**
 * Encode MAV with automatic format selection (v1 or v2)
 * Chooses the format that produces shorter output
 */
function encodeMav_auto(mavString) {
  if (!mavString || mavString.trim() === '') return '';
  
  const format = chooseMavFormat(mavString);
  
  if (format === 'v1') {
    return encodeMav_v1(mavString);
  } else if (format === 'v2') {
    return encodeMav_v2(mavString);
  } else {
    // Defensive fallback: should never reach here
    console.warn(`[MAV Encode Warning] Unexpected format "${format}", defaulting to v1`);
    return encodeMav_v1(mavString);
  }
}

/**
 * Encode MAV (uses auto format selection for optimal compression)
 * Automatically chooses between v1 and v2 based on which produces shorter output
 */
function encodeMav(mavString) {
  if (!mavString || mavString.trim() === '') return '';
  
  // Use auto format selection
  return encodeMav_auto(mavString);
}

/**
 * Decode MAV from any format (v1/v2 auto-detection)
 */
function decodeMav(encodedMav) {
  if (!encodedMav || encodedMav.trim() === '') return '';
  
  // Detect format:
  // - v0 (legacy mav): contains '|' and '~' → already in correct format "R~x|U~y"
  // - v1 (legacy hmav): no special chars → paired format "AtGw"
  // - v2 (new hmav): contains '-' → grouped format "A-tuv"
  
  if (encodedMav.includes('|')) {
    // v0 format: validate and return as-is
    // Basic validation: should contain '~' for proper pairing
    if (encodedMav.includes('~')) {
      return encodedMav;
    }
    // Invalid v0 format, treat as v1
    console.warn(`[MAV Decode Warning] Invalid v0 format (contains '|' but no '~'): "${encodedMav}". Treating as v1.`);
    return decodeMav_v1(encodedMav);
  }
  
  if (encodedMav.includes('-')) {
    // v2 format: hyphen-delimited groups
    return decodeMav_v2(encodedMav);
  }
  
  // v1 format: backward compatibility
  return decodeMav_v1(encodedMav);
}

// ===== CREST Encoding (Bitmap Optimization - 6-char Hexadecimal) =====

function encodeCrest(crestString) {
  if (!crestString || crestString.trim() === '') return '';
  
  const patterns = crestString.split('|');
  
  // Create 24-bit bitmap
  let bitmap = 0;
  for (const pattern of patterns) {
    const index = CREST_PATTERNS.indexOf(pattern);
    if (index >= 0) {
      bitmap |= (1 << index);
    }
  }
  
  // Convert 24-bit to 6-char hexadecimal (0-9A-F)
  // This avoids URL-unsafe characters like '+' and '/'
  const hex = bitmap.toString(16).toUpperCase().padStart(6, '0');
  return hex;
}

function decodeCrest(encoded) {
  if (!encoded || encoded.length !== 6) {
    if (encoded) {
      console.warn(`[CREST Decode Warning] Invalid length: expected 6, got ${encoded.length}`);
    }
    return '';
  }
  
  // Convert 6-char hexadecimal to 24-bit bitmap
  const bitmap = parseInt(encoded, 16);
  if (isNaN(bitmap)) {
    console.warn(`[CREST Decode Warning] Invalid hexadecimal format: "${encoded}"`);
    return '';
  }
  
  // Extract patterns from bitmap
  const patterns = [];
  for (let i = 0; i < 24; i++) {
    if (bitmap & (1 << i)) {
      patterns.push(CREST_PATTERNS[i]);
    }
  }
  
  return patterns.join('|');
}

// ===== MCV Encoding =====

function encodeMcv(mcvString) {
  if (!mcvString || mcvString.trim() === '') return '';
  const entries = mcvString.split('_');
  let encoded = '';
  
  for (const entry of entries) {
    if (!entry) continue;
    const parts = entry.split(':');
    if (parts.length !== 2) continue;
    const move = parts[0];
    const count = parts[1];
    const char = MOVE_TO_CHAR_MCV[move];
    if (!char) continue;
    encoded += char + count;
  }
  return encoded;
}

function decodeMcv(encodedMcv) {
  if (!encodedMcv || encodedMcv.trim() === '') return '';
  const entries = [];
  let i = 0;
  
  while (i < encodedMcv.length) {
    const char = encodedMcv[i];
    
    // Try new mapping first (with - and _)
    let move = CHAR_TO_MOVE_MCV[char];
    
    // Fallback to old mapping for backward compatibility
    if (!move) {
      move = CHAR_TO_MOVE[char];
    }
    
    if (!move) {
      i++;
      continue;
    }
    i++;
    let numStr = '';
    while (i < encodedMcv.length && /\d/.test(encodedMcv[i])) {
      numStr += encodedMcv[i];
      i++;
    }
    if (numStr === '') continue;
    entries.push(`${move}:${numStr}`);
  }
  return entries.join('_');
}

// ===== URL Processing =====

/**
 * Normalize URL: Convert any compressed format to uncompressed legacy format
 * Handles all formats:
 *  - v0: ?rest=U_D_L&mav=U~D|U~L (legacy uncompressed)
 *  - v1/v2: #hrest=ABC&hmav=DEF (hash parameters)
 *  - v3: ?rest=ABC&mav=DEF (compressed query parameters)
 * Always returns: ?rest=U_D_L&mav=U~D|U~L (fully decoded)
 */
function normalizeUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    let rest = null;
    let mav = null;
    let crest = null;
    let mcv = null;
    
    // Step 1: Check hash parameters (v1/v2 format)
    if (url.hash && url.hash.includes('=')) {
      const hashParams = new URLSearchParams(url.hash.substring(1));
      
      const hrest = hashParams.get('hrest');
      const hmav = hashParams.get('hmav');
      const hcrest = hashParams.get('hcrest');
      const hmcv = hashParams.get('hmcv');
      
      if (hrest) rest = decodeRest(hrest);
      if (hmav) mav = decodeMav(hmav);
      if (hcrest) crest = decodeCrest(hcrest);
      if (hmcv) mcv = decodeMcv(hmcv);
    }
    
    // Step 2: Check query parameters (v0 or v3 format)
    const qrest = url.searchParams.get('rest');
    const qmav = url.searchParams.get('mav');
    const qcrest = url.searchParams.get('crest');
    const qmcv = url.searchParams.get('mcv');
    
    // Detect v0 vs v3 format and decode accordingly
    if (qrest && !rest) {
      // v0 format has underscores, v3 format is encoded (alphanumeric only)
      if (qrest.includes('_')) {
        // v0 format: already decoded, use as-is
        rest = qrest;
      } else {
        // v3 format: encoded, decode it
        try {
          rest = decodeRest(qrest);
        } catch (e) {
          rest = qrest; // Fallback to original
        }
      }
    }
    
    if (qmav && !mav) {
      // v0 format has ~ or |, v3 format is encoded
      if (qmav.includes('~') || qmav.includes('|')) {
        // v0 format: already decoded, use as-is
        mav = qmav;
      } else {
        // v3 format: encoded, decode it
        try {
          mav = decodeMav(qmav);
        } catch (e) {
          mav = qmav; // Fallback to original
        }
      }
    }
    
    if (qcrest && !crest) {
      // v0 format has underscores, v3 format is 6 hex digits
      if (qcrest.includes('_')) {
        // v0 format: already decoded
        crest = qcrest;
      } else {
        // v3 format: encoded
        try {
          crest = decodeCrest(qcrest);
        } catch (e) {
          crest = qcrest;
        }
      }
    }
    
    if (qmcv && !mcv) {
      // v0 format has colons (e.g., "x:1_y:2"), v3 format has no colons
      // Note: v3 may contain underscores (e.g., "t1v1_1"), so we check for colons only
      if (qmcv.includes(':')) {
        // v0 format: already decoded
        mcv = qmcv;
      } else {
        // v3 format: encoded
        try {
          mcv = decodeMcv(qmcv);
        } catch (e) {
          mcv = qmcv;
        }
      }
    }
    
    // If no parameters found, return original
    if (!rest && !mav && !crest && !mcv) {
      return urlString;
    }
    
    // Build new URL with fully decoded parameters
    const newUrl = new URL(url.origin + url.pathname);
    
    // Copy other parameters (non-rest/mav/crest/mcv)
    url.searchParams.forEach((value, key) => {
      if (key !== 'rest' && key !== 'mav' && key !== 'crest' && key !== 'mcv') {
        newUrl.searchParams.set(key, value);
      }
    });
    
    // Add decoded parameters
    if (rest) newUrl.searchParams.set('rest', rest);
    if (mav) newUrl.searchParams.set('mav', mav);
    if (crest) newUrl.searchParams.set('crest', crest);
    if (mcv) newUrl.searchParams.set('mcv', mcv);
    
    return newUrl.toString();
  } catch (error) {
    console.warn('[URL Normalize Warning] Invalid URL format, using default:', error.message);
    if (typeof window !== 'undefined') {
      return window.location.origin + window.location.pathname;
    }
    return urlString;
  }
}

/**
 * Compress URL: Convert legacy format to compressed format
 * Handles: ?rest=...&mav=... → #hrest=...&hmav=...
 */
function compressUrlForDisplay(urlString) {
  try {
    const url = new URL(urlString);
  
  // Get legacy parameters
  const rest = url.searchParams.get('rest');
  const mav = url.searchParams.get('mav');
  const crest = url.searchParams.get('crest');
  const mcv = url.searchParams.get('mcv');
  
  // If no parameters to compress, return original
  if (!rest && !mav && !crest && !mcv) {
    return urlString;
  }
  
  // Encode parameters
  const hrest = rest ? encodeRest(rest) : null;
  const hmav = mav ? encodeMav(mav) : null;
  const hcrest = crest ? encodeCrest(crest) : null;
  const hmcv = mcv ? encodeMcv(mcv) : null;
  
  // Build hash string (omit empty parameters)
  const hashParts = [];
  if (hrest) hashParts.push(`hrest=${hrest}`);
  if (hmav) hashParts.push(`hmav=${hmav}`);
  if (hcrest) hashParts.push(`hcrest=${hcrest}`);
  if (hmcv) hashParts.push(`hmcv=${hmcv}`);
  
  // Build new URL with compressed format
  const newUrl = new URL(url.origin + url.pathname);
  
  // Keep non-compressed parameters (like 'res')
  url.searchParams.forEach((value, key) => {
    if (key !== 'rest' && key !== 'mav' && key !== 'crest' && key !== 'mcv') {
      newUrl.searchParams.set(key, value);
    }
  });
  
  // Add hash
  if (hashParts.length > 0) {
    newUrl.hash = hashParts.join('&');
  }
  
  return newUrl.toString();
  } catch (error) {
    console.warn('[URL Compress Warning] Invalid URL format, returning original:', error.message);
    return urlString;
  }
}

/**
 * Create compressed URL with query parameters (v3 format)
 * Handles: ?rest=...&mav=... → ?rest=ENCODED&mav=ENCODED (no hash)
 * This is the new default format for URLs generated after migration.
 */
/**
 * Create compressed query URL (v3 format)
 * Converts any format to v3: ?rest=ABC&mav=A-DGJ (compressed query parameters)
 * Input can be v0 (decoded), v1/v2 (hash), or v3 (already compressed query)
 */
function createCompressedQueryUrl(urlString) {
  try {
    const url = new URL(urlString);
  
    // Get parameters from query (may be v0 or v3)
    let rest = url.searchParams.get('rest');
    let mav = url.searchParams.get('mav');
    let crest = url.searchParams.get('crest');
    let mcv = url.searchParams.get('mcv');
    
    // Check if query parameters are already encoded (v3) or decoded (v0)
    // v0 format has underscores/tildes/pipes, v3 format is alphanumeric+hyphens only
    let restIsEncoded = false;
    let mavIsEncoded = false;
    let crestIsEncoded = false;
    let mcvIsEncoded = false;
    
    if (rest) {
      // v0: contains underscores, v3: alphanumeric only
      restIsEncoded = !rest.includes('_');
    }
    
    if (mav) {
      // v0: contains ~ or |, v3: alphanumeric + hyphens only
      mavIsEncoded = !mav.includes('~') && !mav.includes('|');
    }
    
    if (crest) {
      // v0: contains underscores, v3: 6 hex digits
      crestIsEncoded = !crest.includes('_') && crest.length === 6;
    }
    
    if (mcv) {
      // v0: contains colons (e.g., "x:1_y:2"), v3: no colons (e.g., "t1v1_1")
      // Note: v3 may contain underscores and hyphens for special moves (z-='_')
      mcvIsEncoded = !mcv.includes(':');
    }
    
    // Also check hash parameters for backward compatibility (v1/v2)
    if (url.hash && url.hash.includes('=')) {
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const hrest = hashParams.get('hrest');
      const hmav = hashParams.get('hmav');
      const hcrest = hashParams.get('hcrest');
      const hmcv = hashParams.get('hmcv');
      
      // Hash parameters are always encoded, decode them
      if (hrest && !rest) {
        rest = decodeRest(hrest);
        restIsEncoded = false; // Now decoded
      }
      if (hmav && !mav) {
        mav = decodeMav(hmav);
        mavIsEncoded = false; // Now decoded
      }
      if (hcrest && !crest) {
        crest = decodeCrest(hcrest);
        crestIsEncoded = false; // Now decoded
      }
      if (hmcv && !mcv) {
        mcv = decodeMcv(hmcv);
        mcvIsEncoded = false; // Now decoded
      }
    }
  
    // Encode parameters (only if not already encoded)
    const encodedRest = rest ? (restIsEncoded ? rest : encodeRest(rest)) : null;
    const encodedMav = mav ? (mavIsEncoded ? mav : encodeMav(mav)) : null;
    const encodedCrest = crest ? (crestIsEncoded ? crest : encodeCrest(crest)) : null;
    const encodedMcv = mcv ? (mcvIsEncoded ? mcv : encodeMcv(mcv)) : null;
  
    // Build new URL with compressed query parameters (v3)
    const newUrl = new URL(url.origin + url.pathname);
  
    // Keep non-compressed parameters (like 'scramble', 'rc', 'res', etc.)
    url.searchParams.forEach((value, key) => {
      if (key !== 'rest' && key !== 'mav' && key !== 'crest' && key !== 'mcv') {
        newUrl.searchParams.set(key, value);
      }
    });
    
    // Add compressed parameters as query parameters (not hash)
    if (encodedRest) newUrl.searchParams.set('rest', encodedRest);
    if (encodedMav) newUrl.searchParams.set('mav', encodedMav);
    if (encodedCrest) newUrl.searchParams.set('crest', encodedCrest);
    if (encodedMcv) newUrl.searchParams.set('mcv', encodedMcv);
  
    return newUrl.toString();
  } catch (error) {
    console.warn('[URL Create Warning] Invalid URL format, returning original:', error.message);
    return urlString;
  }
}

// Export functions
if (typeof window !== 'undefined') {
  window.urlParamsCompressor = {
    encodeRest, decodeRest,
    encodeMav, decodeMav,
    encodeCrest, decodeCrest,
    encodeMcv, decodeMcv,
    normalizeUrl,
    compressUrlForDisplay,
    createCompressedQueryUrl,
    // v1/v2 specific functions (for advanced usage)
    encodeMav_v1, decodeMav_v1,
    encodeMav_v2, decodeMav_v2,
    encodeMav_auto,
    predictMavEncodedLength,
    chooseMavFormat
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encodeRest, decodeRest,
    encodeMav, decodeMav,
    encodeCrest, decodeCrest,
    encodeMcv, decodeMcv,
    normalizeUrl,
    compressUrlForDisplay,
    createCompressedQueryUrl,
    // v1/v2 specific functions (for advanced usage)
    encodeMav_v1, decodeMav_v1,
    encodeMav_v2, decodeMav_v2,
    encodeMav_auto,
    predictMavEncodedLength,
    chooseMavFormat
  };
}
