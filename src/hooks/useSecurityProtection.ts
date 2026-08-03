import { useEffect } from 'react';

/**
 * Hook para adicionar uma camada extra de proteção no frontend:
 * - Desativa F12 e atalhos de inspeção (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Cmd+Alt+I)
 * - Desativa o menu de contexto (botão direito do mouse)
 * - (Opcional) Executa detecção básica de DevTools via loop debugger
 */
export function useSecurityProtection(options?: {
  disableContextMenu?: boolean;
  disableInspectKeys?: boolean;
  enableDebuggerLoop?: boolean;
}) {
  const {
    disableContextMenu = true,
    disableInspectKeys = true,
    enableDebuggerLoop = false,
  } = options || {};

  useEffect(() => {
    // Bloquear atalhos de teclado de inspeção do navegador
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!disableInspectKeys) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // F12
      const isF12 = e.key === 'F12' || e.keyCode === 123;

      // Ctrl + Shift + I / J / C (ou Cmd + Alt + I / J / C no Mac)
      const isInspectShortcut =
        (cmdOrCtrl && (e.shiftKey || e.altKey) && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67));

      // Ctrl + U (Ver código fonte da página)
      const isViewSourceShortcut = cmdOrCtrl && (e.key === 'U' || e.key === 'u' || e.keyCode === 85);

      // Ctrl + S (Salvar página)
      const isSaveShortcut = cmdOrCtrl && (e.key === 'S' || e.key === 's' || e.keyCode === 83);

      if (isF12 || isInspectShortcut || isViewSourceShortcut || isSaveShortcut) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Bloquear menu de contexto do botão direito
    const handleContextMenu = (e: MouseEvent) => {
      if (disableContextMenu) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    let debuggerInterval: NodeJS.Timeout | null = null;
    if (enableDebuggerLoop) {
      debuggerInterval = setInterval(() => {
        const start = performance.now();
        // Dispara o depurador caso as ferramentas de desenvolvedor estejam abertas
        (function () {
          return false;
        })
        ['constructor']('debugger')();

        // Se o tempo de execução for alto, significa que o depurador parou no ponto de interrupção
        if (performance.now() - start > 100) {
          console.warn('DevTools detectado.');
        }
      }, 1000);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      if (debuggerInterval) {
        clearInterval(debuggerInterval);
      }
    };
  }, [disableContextMenu, disableInspectKeys, enableDebuggerLoop]);
}
