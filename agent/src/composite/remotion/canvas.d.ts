/**
 * Type declarations for 'canvas' (node-canvas).
 * The native module may not be installed on all platforms.
 * These minimal types satisfy the imports in the Remotion layers.
 */
declare module 'canvas' {
  export interface Canvas {
    width: number
    height: number
    toBuffer(mimeType: string): Buffer
    getContext(contextId: '2d'): CanvasRenderingContext2D
  }

  export interface CanvasRenderingContext2D {
    fillStyle: string | CanvasGradient
    strokeStyle: string
    font: string
    textBaseline: string
    textAlign: string
    lineWidth: number
    globalAlpha: number
    fillRect(x: number, y: number, w: number, h: number): void
    fillText(text: string, x: number, y: number): void
    measureText(text: string): { width: number }
    beginPath(): void
    rect(x: number, y: number, w: number, h: number): void
    clip(): void
    save(): void
    restore(): void
    drawImage(image: any, dx: number, dy: number, dw: number, dh: number): void
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient
  }

  export interface CanvasGradient {
    addColorStop(offset: number, color: string): void
  }

  export interface Image {
    width: number
    height: number
  }

  export function createCanvas(width: number, height: number): Canvas
  export function loadImage(src: string | Buffer): Promise<Image>
}
