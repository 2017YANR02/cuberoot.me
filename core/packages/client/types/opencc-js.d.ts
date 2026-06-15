declare module 'opencc-js' {
  type Locale = 'cn' | 'tw' | 'twp' | 'hk' | 'jp' | 't';
  interface ConverterOptions {
    from: Locale;
    to: Locale;
  }
  export function Converter(options: ConverterOptions): (text: string) => string;
}
