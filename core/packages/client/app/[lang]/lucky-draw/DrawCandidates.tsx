"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { drawStageCards, type Session, type Ticket } from "@cuberoot/shared/draw";

export default function DrawCandidates({ session, last, busy }: {
  session: Session;
  last: Ticket[];
  busy: boolean;
}) {
  const orbit = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const cards = useMemo(() => drawStageCards(session, last, busy), [session, last, busy]);

  useEffect(() => {
    if (!session.stage || !orbit.current) return;
    const nodes = Array.from(orbit.current.children) as HTMLElement[];
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 0;
    let visible = true;
    let scale = 1;
    const finished = last.length > 0 && !busy;

    // Use the approved mock's geometry, speed and depth opacity directly.
    function paint() {
      nodes.forEach((node, i) => {
        let x: number, y: number, z: number, yaw: number, tilt: number;
        if (!session.training) {
          const latitude = Math.acos(1 - 2 * (i + 0.5) / Math.max(nodes.length, 1));
          const longitude = i * 2.399963 + angle.current;
          const radius = nodes.length === 1 ? 0 : 157 * scale;
          x = Math.sin(latitude) * Math.cos(longitude) * radius;
          y = Math.cos(latitude) * radius;
          z = Math.sin(latitude) * Math.sin(longitude) * radius;
          yaw = Math.cos(longitude) * 14;
          tilt = Math.cos(latitude) * 4;
        } else {
          const columns = Math.min(nodes.length, 4);
          const rows = Math.ceil(nodes.length / Math.max(columns, 1));
          const row = Math.floor(i / columns);
          const inRow = Math.min(columns, nodes.length - row * columns);
          const phase = angle.current + i * 0.72;
          x = ((i % columns - (inRow - 1) / 2) * 86 + Math.sin(phase) * 15) * scale;
          y = ((row - (rows - 1) / 2) * 64 + Math.cos(phase) * 14) * scale;
          z = ((i % 3) - 1) * 45 + Math.sin(phase) * 16;
          yaw = Math.sin(phase) * 19;
          tilt = Math.cos(i * 2.3 + angle.current) * 15;
          if (busy) { x *= 0.64; y *= 0.64; yaw += Math.sin(angle.current) * 35; }
        }
        node.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateY(${yaw}deg) rotateZ(${tilt}deg)`;
        node.style.opacity = String(0.45 + (z + 160) / 320 * 0.55);
      });
    }

    function tick(now: number) {
      const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 0;
      previous = now;
      angle.current = (angle.current + dt * (busy ? 6 : 0.17)) % (Math.PI * 2);
      paint();
      frame = requestAnimationFrame(tick);
    }

    function sync() {
      cancelAnimationFrame(frame);
      previous = 0;
      paint();
      if (visible && !document.hidden && !motion.matches && !finished && cards.length > 1) {
        frame = requestAnimationFrame(tick);
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(orbit.current);
    const resize = new ResizeObserver(([entry]) => {
      scale = Math.max(0, Math.min(1, (entry.contentRect.width - 80) / 420));
      paint();
    });
    resize.observe(orbit.current);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      nodes.forEach(node => {
        node.style.removeProperty("transform");
        node.style.removeProperty("opacity");
      });
    };
  }, [cards, session.stage, session.training, busy, last.length]);

  return <div className="draw-cloud" aria-hidden="true">
    <div className="draw-orbit" ref={orbit}>
      {cards.map(ticket => <div className="draw-slot" key={ticket.id} style={ticket.pose as CSSProperties}>
        <div className="draw-card">
          <strong>{ticket.name}</strong>
          {ticket.number && <small>#{ticket.number}</small>}
        </div>
      </div>)}
    </div>
  </div>;
}
