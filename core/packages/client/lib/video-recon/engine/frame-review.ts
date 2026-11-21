/** Nearest cached ordinal; source-frame IDs may jump by two at 60fps. */
export function reviewIndex(rows:readonly {timestamp:number}[],timestamp:number) {
 let lo=0,hi=rows.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid].timestamp<timestamp)lo=mid+1;else hi=mid;}
 if(!rows.length)return -1;
 if(!lo)return 0;if(lo===rows.length)return lo-1;
 return timestamp-rows[lo-1].timestamp<=rows[lo].timestamp-timestamp?lo-1:lo;
}
export function steppedTimestamp(rows:readonly {timestamp:number}[],timestamp:number,direction:-1|1) {
 const index=reviewIndex(rows,timestamp);if(index<0)return;
 return rows[Math.max(0,Math.min(rows.length-1,index+direction))].timestamp;
}
export function frameArrow(event:Pick<KeyboardEvent,"key"|"altKey"|"ctrlKey"|"metaKey"|"shiftKey">,target:Element|null) {
 if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return 0;
 if(target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']") &&
    target.getAttribute("aria-label")!=="Video position")return 0;
 return event.key==="ArrowLeft"?-1:event.key==="ArrowRight"?1:0;
}
