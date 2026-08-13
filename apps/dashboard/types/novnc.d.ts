declare module "@novnc/novnc" {
  export default class RFB {
    constructor(
      target: HTMLElement,
      url: string,
      options?: { credentials?: { password?: string } },
    );
    scaleViewport: boolean;
    resizeSession: boolean;
    disconnect(): void;
    addEventListener(type: string, listener: (event: CustomEvent) => void): void;
    removeEventListener(type: string, listener: (event: CustomEvent) => void): void;
  }
}
