import {LitElement, html, css, svg} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {until} from 'lit/directives/until.js';
import {marked} from 'marked';
import jsPDF from 'jspdf';
import {Analysis} from '../analysis-service';

@customElement('analysis-modal')
export class AnalysisModal extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) analyses: Analysis[] = [];
  @state() private selectedAnalysisId: string | null = null;

  static styles = css`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
    }
    .modal-content {
      background: rgba(30, 30, 30, 0.9);
      padding: 0;
      border-radius: 12px;
      width: clamp(300px, 80vw, 1000px);
      max-height: 85vh;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #eee;
      font-family: sans-serif;
      display: flex;
      flex-direction: row;
    }
    .analysis-sidebar {
      width: 250px;
      flex-shrink: 0;
      background: rgba(0, 0, 0, 0.2);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      overflow-y: auto;
    }
    .analysis-sidebar button {
      width: 100%;
      padding: 10px;
      border: none;
      background: transparent;
      color: #ccc;
      text-align: left;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: all 0.2s ease;
    }
    .analysis-sidebar button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .analysis-sidebar button.active {
      background: #5078ff;
      color: #fff;
      font-weight: bold;
    }
    .analysis-main {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
    }
    .analysis-main h3 {
      margin: 0 0 16px 0;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .analysis-text-content {
      flex-grow: 1;
      overflow-y: auto;
      padding-right: 16px;
    }
    .analysis-text-content h1,
    .analysis-text-content h2,
    .analysis-text-content h3 {
      color: #87cefa;
      border-bottom: 1px solid #444;
      padding-bottom: 4px;
    }
    .analysis-text-content a {
      color: #87cefa;
    }
    .analysis-text-content code {
      background: rgba(0, 0, 0, 0.5);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
    }
    .analysis-text-content pre {
      background: rgba(0, 0, 0, 0.5);
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin-top: 20px;
      flex-shrink: 0;
    }
    .modal-actions button {
      border: 1px solid #5078ff;
      background: transparent;
      color: #5078ff;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .modal-actions button:hover {
      background: rgba(80, 120, 255, 0.2);
    }
    .modal-actions button.primary-btn {
      background: #5078ff;
      color: white;
    }
  `;

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (!this.show) return;
    if (
      changedProperties.has('analyses') ||
      (changedProperties.has('show') && this.show)
    ) {
      const analysisExists = this.analyses.some(
        (a) => a.id === this.selectedAnalysisId,
      );
      if (!this.selectedAnalysisId || !analysisExists) {
        this.selectedAnalysisId = this.analyses[0]?.id || null;
      }
    }
  }

  private getCurrentAnalysis(): Analysis | undefined {
    return this.analyses.find((a) => a.id === this.selectedAnalysisId);
  }

  private closeModal() {
    this.dispatchEvent(new CustomEvent('close-modal'));
  }

  private logAndDispatch(message: string, type: string) {
    this.dispatchEvent(new CustomEvent('log-event', {detail: {message, type}}));
  }

  private downloadPdf() {
    const analysis = this.getCurrentAnalysis();
    if (!analysis) return;

    this.logAndDispatch(`Baixando PDF: ${analysis.title}`, 'info');

    const content = this.shadowRoot?.getElementById('analysis-content-for-pdf');
    if (content) {
      const doc = new jsPDF();
      doc.html(content, {
        callback: (doc) => {
          doc.save(`${analysis.title}.pdf`);
          this.logAndDispatch('PDF baixado com sucesso.', 'success');
        },
        x: 10,
        y: 10,
        width: 180,
        windowWidth: 800,
      });
    }
  }

  private downloadMarkdown() {
    const analysis = this.getCurrentAnalysis();
    if (!analysis) return;

    this.logAndDispatch(`Baixando Markdown: ${analysis.title}`, 'info');
    const blob = new Blob([analysis.summary], {type: 'text/markdown'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.logAndDispatch('Markdown baixado com sucesso.', 'success');
  }

  private async shareAnalysis() {
    const analysis = this.getCurrentAnalysis();
    if (!analysis) return;

    const shareData = {
      title: `Análise: ${analysis.title}`,
      text: analysis.summary,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        this.logAndDispatch('Compartilhando análise...', 'info');
        await navigator.share(shareData);
        this.logAndDispatch('Análise compartilhada com sucesso.', 'success');
      } catch (err) {
        // Ignore user cancellation
        if ((err as Error).name !== 'AbortError') {
          console.error('Erro ao compartilhar:', err);
          this.logAndDispatch(
            `Falha ao compartilhar: ${(err as Error).message}`,
            'error',
          );
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(analysis.summary);
        this.logAndDispatch(
          'Resumo copiado para a área de transferência.',
          'success',
        );
      } catch (err) {
        this.logAndDispatch(
          `Falha ao copiar: ${(err as Error).message}`,
          'error',
        );
      }
    }
  }

  render() {
    if (!this.show) return html``;

    const currentAnalysis = this.getCurrentAnalysis();
    const titlePromise = Promise.resolve(currentAnalysis?.title);

    return html`
      <div class="modal-overlay" @click=${this.closeModal}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="analysis-sidebar">
            ${this.analyses.map(
              (analysis) => html`
                <button
                  class=${this.selectedAnalysisId === analysis.id
                    ? 'active'
                    : ''}
                  @click=${() => (this.selectedAnalysisId = analysis.id)}>
                  ${until(
                    Promise.resolve(analysis.title),
                    'Carregando...',
                  )}
                </button>
              `,
            )}
          </div>
          <div class="analysis-main">
            <h3>
              Análise:
              ${until(titlePromise, currentAnalysis ? 'Carregando...' : 'Nenhuma selecionada')}
            </h3>
            <div id="analysis-content-for-pdf" class="analysis-text-content">
              ${currentAnalysis
                ? unsafeHTML(marked(currentAnalysis.summary))
                : html`<p>Selecione uma análise na barra lateral.</p>`}
            </div>
            ${currentAnalysis
              ? html`
                  <div class="modal-actions">
                    <button @click=${this.shareAnalysis}>Compartilhar</button>
                    <button @click=${this.downloadMarkdown}>Baixar MD</button>
                    <button @click=${this.downloadPdf}>Baixar PDF</button>
                    <button @click=${this.closeModal} class="primary-btn">
                      Fechar
                    </button>
                  </div>
                `
              : ''}
          </div>
        </div>
      </div>
    `;
  }
}
