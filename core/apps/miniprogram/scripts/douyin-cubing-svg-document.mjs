import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';

const hostDocument = new DOMImplementation().createDocument(null, null, null);
const parser = new DOMParser();
const serializer = new XMLSerializer();

function readStyle(element, name) {
  return element.getAttribute('style')?.split(';').map(property => property.split(':')).find(([key]) => key.trim() === name)?.[1]?.trim() ?? '';
}

function writeStyle(element, name, value) {
  element.setAttribute('style', `${element.getAttribute('style') ?? ''};${name}:${value}`);
}

function prepareSvgElement(element) {
  if (element.style) return element;
  element.style = {
    get fill() { return readStyle(element, 'fill'); },
    set maxWidth(value) { writeStyle(element, 'max-width', value); },
    set maxHeight(value) { writeStyle(element, 'max-height', value); },
  };
  return element;
}

function svgWrapper() {
  let svg;
  let byId;
  return {
    classList: { add() {} },
    set innerHTML(source) {
      const parsed = parser.parseFromString(source, 'image/svg+xml');
      svg = prepareSvgElement(parsed.documentElement);
      const children = Array.from(svg.getElementsByTagName('*'));
      byId = new Map(children.filter(element => element.hasAttribute('id')).map(element => [element.getAttribute('id'), element]));
      svg.querySelectorAll = (selector) => {
        if (selector === '[data-copy-id]') return children.filter(element => element.hasAttribute('data-copy-id'));
        if (selector === '.hint-facelet') return children.filter(element => (element.getAttribute('class') ?? '').split(/\s+/).includes('hint-facelet'));
        throw new Error(`Unsupported SVG selector: ${selector}`);
      };
    },
    querySelector(selector) {
      if (selector === 'svg') return svg;
      const element = byId?.get(selector.slice(1));
      return element ? prepareSvgElement(element) : undefined;
    },
  };
}

/** XML-only host for cubing's existing Timer preview animator. */
export const svgAnimatorDocument = {
  createElement: svgWrapper,
  createElementNS(namespace, name) { return hostDocument.createElementNS(namespace, name); },
};

export function serializeTimerPreviewSvg(element) {
  for (const hint of element.querySelectorAll('.hint-facelet')) hint.parentNode?.removeChild(hint);
  return serializer.serializeToString(element);
}
