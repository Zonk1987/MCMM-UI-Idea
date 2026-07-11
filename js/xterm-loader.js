// js/xterm-loader.js

let xtermPromise = null;

/**
 *
 */
export function loadXterm() {
  if (window.Terminal && window.FitAddon) {
    return Promise.resolve();
  }

  if (xtermPromise) {
    return xtermPromise;
  }

  xtermPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-xterm-css]')) {
      const stylesheet = document.createElement('link');

      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'css/vendor/xterm.css';
      stylesheet.dataset.xtermCss = 'true';

      document.head.appendChild(stylesheet);
    }

    const terminalScript = document.createElement('script');

    terminalScript.src = 'js/vendor/xterm.js';

    terminalScript.onload = () => {
      const fitAddonScript = document.createElement('script');

      fitAddonScript.src = 'js/vendor/xterm-addon-fit.js';
      fitAddonScript.onload = resolve;
      fitAddonScript.onerror = reject;

      document.head.appendChild(fitAddonScript);
    };

    terminalScript.onerror = reject;

    document.head.appendChild(terminalScript);
  });

  return xtermPromise;
}
