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

@customElement('gdm-analysis-modal')
export class GdmAnalysisModal extends LitElement {
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
      -webkit-backdrop-filter: blur(5px);
    }

    .modal-content {
      background: rgba(30, 30, 30, 0.9);
      border-radius: 12px;
      width: clamp(300px, 80vw, 1000px);
      max-height: 85vh;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #eee;
      font-family: sans-serif;
      display: flex;
      flex-direction: row;
      gap: 20px;
      padding: 0;
    }

    .modal-content h3 {
      margin: 24px 24px 0 24px;
      color: #5078ff;
      flex-shrink: 0;
    }

    .analysis-sidebar {
      flex: 0 0 250px;
      background: rgba(0, 0, 0, 0.2);
      padding: 24px 8px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      overflow-y: auto;
    }
    .analysis-sidebar button {
      display: block;
      width: 100%;
      background: transparent;
      border: none;
      color: #ccc;
      padding: 12px 16px;
      text-align: left;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background-color 0.2s, color 0.2s;
    }
    .analysis-sidebar button:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
    }
    .analysis-sidebar button.active {
      background: rgba(80, 120, 255, 0.3);
      color: #fff;
      font-weight: 600;
    }

    .analysis-main {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
      padding-top: 0; /* h3 has its own margin */
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
      justify-content: flex-end;
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
    if (!this.show) {
      return html``;
    }

    const currentAnalysis = this.getCurrentAnalysis();

    return html`
      <div class="modal-overlay" @click=${this._close}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="analysis-sidebar">
            ${this.analyses.map(
              (analysis) => html`
                <button
                  class=${this.selectedAnalysisId === analysis.id
                    ? 'active'
                    : ''}
                  @click=${() => (this.selectedAnalysisId = analysis.id)}
                  title=${analysis.title}>
                  ${analysis.title}
                </button>
              `,
            )}
          </div>

          <div class="analysis-main">
            <h3>Análise: ${currentAnalysis?.title || 'Nenhuma selecionada'}</h3>
            <div id="analysis-content-for-pdf" class="analysis-text-content">
              ${currentAnalysis
                ? unsafeHTML(marked.parse(currentAnalysis.summary) as string)
                : html`<p>Selecione uma análise na lista ao lado.</p>`}
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
              <button class="primary-btn" @click=${this._close}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-analysis-modal': GdmAnalysisModal;
  }
}
