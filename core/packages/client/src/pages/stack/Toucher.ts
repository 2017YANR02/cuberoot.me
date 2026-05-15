// Ported from huazhechen/cuber (MIT) — src/vue/Viewport/toucher.ts
import { TouchAction } from "./cuber/controller";

export default class Toucher {
  dom!: HTMLElement;
  callback!: (action: TouchAction) => void;
  target: EventTarget | null = null;
  last: Touch | null = null;

  init(dom: HTMLElement, callback: (action: TouchAction) => void): void {
    this.dom = dom;
    this.callback = callback;
    document.addEventListener("touchstart", this.touch);
    document.addEventListener("touchmove", this.touch);
    document.addEventListener("touchend", this.touch);
    document.addEventListener("touchcancel", this.touch);
    document.addEventListener("mousedown", this.mouse);
    document.addEventListener("mousemove", this.mouse);
    document.addEventListener("mouseup", this.mouse);
  }

  destroy(): void {
    document.removeEventListener("touchstart", this.touch);
    document.removeEventListener("touchmove", this.touch);
    document.removeEventListener("touchend", this.touch);
    document.removeEventListener("touchcancel", this.touch);
    document.removeEventListener("mousedown", this.mouse);
    document.removeEventListener("mousemove", this.mouse);
    document.removeEventListener("mouseup", this.mouse);
  }

  mouse = (event: MouseEvent): boolean => {
    if (event.type === "mousedown") {
      this.target = event.target;
    }
    if (this.target !== this.dom) {
      return true;
    }
    this.dom.tabIndex = 1;
    this.dom.focus();
    const rect = this.dom.getBoundingClientRect();
    const action = new TouchAction(event.type, event.clientX - rect.left, event.clientY - rect.top);
    this.callback(action);
    if (event.cancelable) event.preventDefault();
    if (event.type === "mouseup") {
      this.target = null;
    }
    return false;
  };

  touch = (event: TouchEvent): boolean => {
    const first = event.changedTouches[0];
    if (event.type === "touchstart") {
      this.target = event.target;
      if (this.last) {
        const action = new TouchAction(
          "touchend",
          this.last.clientX - this.dom.getBoundingClientRect().left,
          this.last.clientY - this.dom.getBoundingClientRect().top
        );
        this.callback(action);
      }
      this.last = first;
    }
    if (this.target !== this.dom || this.last?.identifier != first.identifier) {
      return false;
    }
    this.dom.tabIndex = 1;
    this.dom.focus();
    const action = new TouchAction(
      event.type,
      first.clientX - this.dom.getBoundingClientRect().left,
      first.clientY - this.dom.getBoundingClientRect().top
    );
    this.callback(action);
    event.preventDefault();
    if (event.type === "touchend" || event.type === "touchcancel") {
      this.target = null;
    }
    return true;
  };
}
