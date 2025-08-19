/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, svg} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {marked} from 'marked';
import jsPDF from 'jspdf';
import type {Analysis} from './types';

@customElement('gdm-analysis-panel')
export class GdmAnalysisPanel extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) analyses: Analysis[] = [];

  @state() private selectedAnalysisId: string | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: rgba(30, 30, 30, 0.9);
      border-right: 1px solid rgba(255, 255, 255, 0.2);
      color: #eee;
      font-family: sans-serif;
      overflow: hidden;
      box-sizing: border-box;
      padding: 0;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      padding-bottom: 0;
      flex-shrink: 0;
    }

    .panel-header h3 {
      margin: 0;
      color: #5078ff;
    }

    .panel-header .close-button {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .panel-header .close-button:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.1);
    }

    .panel-body {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
      padding-top: 16px;
    }

    .analysis-main {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0;
      min-width: 0; /* Fix for flexbox overflow */
    }

    .analysis-selector {
      margin-bottom: 16px;
      flex-shrink: 0;
    }

    .analysis-selector select {
      width: 100%;
      padding: 12px;
      background-color: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #eee;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' height='24' viewBox='0 -960 960 960' width='24' fill='%23999'%3E%3Cpath d='M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 40px; /* Make space for arrow */
    }

    .analysis-selector select:focus {
      outline: none;
      border-color: #5078ff;
    }

    .analysis-title {
      margin: 0 0 16px 0;
      font-size: 1.1em;
      font-weight: 600;
      color: #fff;
      flex-shrink: 0;
    }

    .analysis-text-content {
      flex-grow: 1;
      overflow-y: auto;
      padding: 1px 16px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      line-height: 1.6;
      color: #eee;
    }
    .analysis-text-content h1,
    .analysis-text-content h2,
    .analysis-text-content h3,
    .analysis-text-content h4 {
      color: #87cefa;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 8px;
      margin-top: 24px;
    }
    .analysis-text-content p {
      margin-bottom: 12px;
    }
    .analysis-text-content ul,
    .analysis-text-content ol {
      padding-left: 24px;
    }
    .analysis-text-content li {
      margin-bottom: 8px;
    }
    .analysis-text-content strong {
      color: #fff;
      font-weight: 600;
    }
    .analysis-text-content blockquote {
      border-left: 4px solid #5078ff;
      padding-left: 16px;
      margin-left: 0;
      color: #ccc;
      font-style: italic;
    }
    .analysis-text-content code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
    .analysis-text-content pre > code {
      display: block;
      padding: 12px;
      white-space: pre-wrap;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-start;
      gap: 12px;
      margin-top: 24px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .modal-actions button {
      padding: 10px 20px;
      border-radius: 20px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s;
    }
    .modal-actions button:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .modal-actions .primary-btn {
      background: #5078ff;
    }
    .modal-actions .primary-btn:hover {
      background: #6a8dff;
    }

    @media (max-width: 800px) {
      .panel-header {
        padding: 16px;
        padding-bottom: 0;
      }
      .panel-body {
        padding: 16px;
      }
    }
  `;

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (
      (changedProperties.has('show') &&
        this.show &&
        this.analyses.length > 0 &&
        !this.selectedAnalysisId) ||
      (changedProperties.has('analyses') &&
        this.show &&
        this.analyses.length > 0 &&
        !this.analyses.find((a) => a.id === this.selectedAnalysisId))
    ) {
      this.selectedAnalysisId = this.analyses[0]?.id || null;
    }
  }

  private _close() {
    this.dispatchEvent(
      new CustomEvent('close', {bubbles: true, composed: true}),
    );
  }

  private _handleAnalysisSelectionChange(e: Event) {
    const selectElement = e.target as HTMLSelectElement;
    this.selectedAnalysisId = selectElement.value;
  }

  private getCurrentAnalysis(): Analysis | undefined {
    if (!this.selectedAnalysisId) return undefined;
    return this.analyses.find((a) => a.id === this.selectedAnalysisId);
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9._-]/gi, '_').substring(0, 100);
  }

  private downloadMarkdown() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return;
    const blob = new Blob([currentAnalysis.summary], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.sanitizeFilename(currentAnalysis.title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async downloadPdf() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return;
    const contentElement = this.shadowRoot?.getElementById(
      'analysis-content-for-pdf',
    );
    if (!contentElement) return;

    try {
      // Dynamically import html2canvas
      const {default: html2canvas} = await import('html2canvas');
      const pdf = new jsPDF({orientation: 'p', unit: 'pt', format: 'a4'});
      await pdf.html(contentElement, {
        callback: (doc) => {
          doc.save(`${this.sanitizeFilename(currentAnalysis.title)}.pdf`);
        },
        margin: [40, 40, 40, 40],
        autoPaging: 'text',
        html2canvas: {scale: 0.7, useCORS: true, backgroundColor: null},
        width: 515,
        windowWidth: contentElement.scrollWidth,
      });
    } catch (err) {
      console.error('PDF Generation Error:', err);
    }
  }

  private async shareAnalysis() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return;

    const shareData = {
      title: `Análise: ${currentAnalysis.title}`,
      text: currentAnalysis.summary,
    };

    if (navigator.share) {
      await navigator.share(shareData).catch(console.warn);
    } else {
      await navigator.clipboard
        .writeText(currentAnalysis.summary)
        .catch(console.error);
    }
  }

  render() {
    const currentAnalysis = this.getCurrentAnalysis();

    return html`
      <div class="panel-header">
        <h3>Análises de Conteúdo</h3>
        <button
          class="close-button"
          @click=${this._close}
          title="Fechar painel"
          aria-label="Fechar painel">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="28px"
            viewBox="0 -960 960 960"
            width="28px"
            fill="currentColor">
            <path
              d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
          </svg>
        </button>
      </div>
      <div class="panel-body">
        <div class="analysis-main">
          ${
            this.analyses.length > 1
              ? html`
                  <div class="analysis-selector">
                    <select
                      @change=${this._handleAnalysisSelectionChange}
                      .value=${this.selectedAnalysisId || ''}
                      aria-label="Selecionar análise para visualizar">
                      ${this.analyses.map(
                        (analysis) => html`
                          <option value=${analysis.id}>${analysis.title}</option>
                        `,
                      )}
                    </select>
                  </div>
                `
              : html`
                  <h4 class="analysis-title">
                    ${currentAnalysis?.title || 'Selecione uma análise'}
                  </h4>
                `
          }
          <div id="analysis-content-for-pdf" class="analysis-text-content">
            ${currentAnalysis
              ? unsafeHTML(marked.parse(currentAnalysis.summary) as string)
              : html`<p>Nenhuma análise selecionada.</p>`}
          </div>
          <div class="modal-actions">
            <button
              @click=${this.downloadPdf}
              title="Baixar como PDF"
              ?disabled=${!currentAnalysis}>
              ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320v80H240v640h480v-400h80v400q0 33-23.5 56.5T720-80H240Zm420-520v-280l280 280h-280Z" /></svg>`}
              <span>PDF</span>
            </button>
            <button
              @click=${this.downloadMarkdown}
              title="Baixar como Markdown (.md)"
              ?disabled=${!currentAnalysis}>
              ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-320 280-520l56-56 104 104v-328h80v328l104-104 56 56-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" /></svg>`}
              <span>MD</span>
            </button>
            <button
              @click=${this.shareAnalysis}
              title="Compartilhar Análise"
              ?disabled=${!currentAnalysis}>
              ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-14.5L323-400q-21 15-47.5 23T220-360q-50 0-85-35t-35-85q0-50 35-85t85-35q30 0 56.5 10.5T323-560l281-171q-1-5-1.5-11.5T602-760q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-28 0-53.5-9.5T620-640L340-468q1 7 1.5 13.5t.5 14.5q0 7-1 14.5t-3 14.5l281 171q21-14 47-21.5t54-7.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-640q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720ZM220-440q17 0 28.5-11.5T260-480q0-17-11.5-28.5T220-520q-17 0-28.5 11.5T180-480q0 17 11.5 28.5T220-440Zm500 280q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160Z" /></svg>`}
              <span>Compartilhar</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-analysis-panel': GdmAnalysisPanel;
  }
}
