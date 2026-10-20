import { toast } from 'react-hot-toast';

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );
};

const PORTS = [8765, 8766, 8767, 8768, 8769];

class ImprentaTrayService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private connectPromise: Promise<boolean> | null = null;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private seq = 0;
  private cachedPrinters: string[] | null = null;
  private lastPrintersFetch = 0;

  private _open(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(`ws://127.0.0.1:${port}`);
      } catch (e) {
        return reject(e);
      }
      const timer = setTimeout(() => {
        try { ws.close(); } catch (_) {}
        reject(new Error('timeout'));
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timer);
        resolve(ws);
      };
      ws.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  }

  async connect(): Promise<boolean> {
    if (isMobileDevice()) return false;
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) return true;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      for (const port of PORTS) {
        try {
          const ws = await this._open(port);
          ws.onmessage = (ev) => {
            try {
              const msg = JSON.parse(ev.data);
              if (msg.event) return;
              const p = this.pending.get(msg.id);
              if (!p) return;
              this.pending.delete(msg.id);
              if (msg.error) {
                p.reject(new Error(msg.error));
              } else {
                p.resolve(msg.result);
              }
            } catch (err) {
              console.error('Error procesando respuesta Imprenta Labs:', err);
            }
          };

          ws.onclose = () => {
            this.ws = null;
            this.isConnected = false;
            this.pending.forEach((p) => p.reject(new Error('Conexión cerrada')));
            this.pending.clear();
          };

          this.ws = ws;
          this.isConnected = true;
          return true;
        } catch (_) {}
      }
      return false;
    })().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async call<T = any>(call: string, params: any = {}): Promise<T> {
    const ok = await this.connect();
    if (!ok) throw new Error('Imprenta Labs no está activo en este equipo');

    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.ws!.send(JSON.stringify({ id, call, params }));
      } catch (err) {
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async getPrinters(forceRefresh = false): Promise<string[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedPrinters && now - this.lastPrintersFetch < 120000) {
      return this.cachedPrinters;
    }

    try {
      const printers = await this.call<string[]>('printers.find');
      const list = Array.isArray(printers) ? printers : [];
      this.cachedPrinters = list;
      this.lastPrintersFetch = Date.now();
      return list;
    } catch (err: any) {
      console.warn('Error buscando impresoras en Imprenta Labs:', err);
      return [];
    }
  }

  async resolvePrinter(targetName?: string | null): Promise<string | null> {
    try {
      const allPrinters = await this.getPrinters();
      if (!allPrinters || allPrinters.length === 0) return null;

      if (targetName && targetName.trim() !== '' && targetName.trim().toUpperCase() !== 'DEFAULT') {
        const cleanTarget = targetName.trim().toLowerCase();
        const exact = allPrinters.find((p) => p.toLowerCase() === cleanTarget);
        if (exact) return exact;

        const partial = allPrinters.find(
          (p) => p.toLowerCase().includes(cleanTarget) || cleanTarget.includes(p.toLowerCase())
        );
        if (partial) return partial;

        return null;
      }

      try {
        const def = await this.call<string>('printers.getDefault');
        if (def) return def;
      } catch (_) {}

      const physicalPrinter = allPrinters.find(
        (p) =>
          !p.toLowerCase().includes('pdf') &&
          !p.toLowerCase().includes('onenote') &&
          !p.toLowerCase().includes('xps')
      );
      return physicalPrinter || allPrinters[0];
    } catch (err) {
      console.error('Error resolviendo impresora:', err);
      return null;
    }
  }

  async getPrinterStatus(printerName: string) {
    try {
      return await this.call('printers.status', { printer: printerName });
    } catch (_) {
      return null;
    }
  }

  async printHTML(printerName: string, htmlContent: string, allowFallback = false): Promise<boolean> {
    if (isMobileDevice()) {
      console.log('📱 Dispositivo móvil: Impresión local omitida (se procesa en el PC central)');
      return false;
    }

    const connected = await this.connect();
    if (!connected) {
      if (allowFallback) {
        toast.error('Imprenta Labs no está conectado. Abriendo impresión del navegador...');
        this.fallbackBrowserPrint(htmlContent);
      } else {
        toast.error('Imprenta Labs no está activo. Inicia la aplicación en la bandeja del sistema.');
      }
      return false;
    }

    try {
      const resolvedPrinter = await this.resolvePrinter(printerName);
      if (!resolvedPrinter) {
        if (allowFallback) {
          toast.error(`No se encontró la impresora "${printerName}". Abriendo navegador...`);
          this.fallbackBrowserPrint(htmlContent);
        } else {
          toast.error(`No se encontró la impresora "${printerName}".`);
        }
        return false;
      }

      // Comprobar estado previo (sin papel, apagada)
      const st = await this.getPrinterStatus(resolvedPrinter);
      if (st && st.warning === 'paper_low') {
        toast('⚠️ Advertencia: Poco papel en ' + resolvedPrinter, { icon: '🧻' });
      }

      console.log(`🖨️ [Imprenta Labs] Enviando HTML a "${resolvedPrinter}"...`);
      const res = await this.call('html', {
        printer: resolvedPrinter,
        html: htmlContent,
        widthDots: 576,
        cut: true,
        job: 'Comanda Gastro',
      });

      if (res && res.state === 'queued') {
        toast(`Ticket en cola para ${resolvedPrinter} (se imprimirá al reconectar)`, { icon: '⏳' });
      } else {
        toast.success(`Comanda impresa en ${resolvedPrinter}`, { icon: '🖨️' });
      }
      return true;
    } catch (err: any) {
      console.error(`Error imprimiendo en ${printerName}:`, err);
      if (allowFallback) {
        this.fallbackBrowserPrint(htmlContent);
      } else {
        toast.error(`Error de impresión: ${err?.message || err}`);
      }
      return false;
    }
  }

  fallbackBrowserPrint(htmlContent: string) {
    if (isMobileDevice()) return;
    try {
      const win = window.open('', '', 'width=450,height=600');
      if (win) {
        win.document.write(htmlContent);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
      }
    } catch (e) {
      console.error('Error en fallbackBrowserPrint:', e);
    }
  }
}

export const imprentaService = new ImprentaTrayService();
