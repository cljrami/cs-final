// Declaraciones TypeScript para gif.js (v0.2.0 - jnordberg/gif.js)
// No incluye archivos .d.ts oficiales

declare module 'gif.js' {
  interface GIFOptions {
    workerScript?: string;
    workers?: number;
    repeat?: number;
    background?: string;
    quality?: number;
    width?: number;
    height?: number;
    transparent?: string | null;
    debug?: boolean;
    dither?: boolean;
    globalPalette?: boolean;
  }

  interface FrameOptions {
    delay?: number;
    copy?: boolean;
  }

  interface GIF {
    running?: boolean;
    on(event: 'progress', listener: (progress: number) => void): void;
    on(event: 'finished', listener: (blob: Blob) => void): void;
    on(event: 'start', listener: () => void): void;
    on(event: 'abort', listener: () => void): void;
    addFrame(image: CanvasRenderingContext2D | ImageData | HTMLElement, options?: FrameOptions): void;
    render(): void;
    abort(): void;
  }

  const GIF: {
    new (options: GIFOptions): GIF;
  };

  export default GIF;
}
