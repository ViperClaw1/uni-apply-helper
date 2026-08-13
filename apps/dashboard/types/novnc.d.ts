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
    /** Manual key injection — bypasses the browser's native (often unreliable) handling of
     * toggle keys like Caps Lock. Omitting `down` sends a full press+release pair. */
    sendKey(keysym: number, code?: string | null, down?: boolean): void;
  }
}
