declare module 'marked-terminal' {
  interface TerminalRendererOptions {
    reflowText?: boolean;
    width?: number;
  }

  class TerminalRenderer {
    constructor(options?: TerminalRendererOptions);
  }

  export default TerminalRenderer;
}
