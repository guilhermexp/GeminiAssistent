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
import './video-player.js';
import './copy-button.ts';

@customElement('gdm-analysis-panel')
export class GdmAnalysisPanel extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) analyses: Analysis[] = [];

  @state() private selectedAnalysisId: string | null = null;
  @state() private pdfBlobUrl: string | null = null;
  @state() private isActionsMenuOpen = false;
  @state() private activeTab: 'analysis' | 'json' = 'analysis';
  private lastProcessedPreviewData: string | undefined = undefined;

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
      padding-bottom: 16px;
      flex-shrink: 0;
    }

    .panel-header h3 {
      margin: 0;
      color: #5078ff;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .actions-menu-container {
      position: relative;
    }

    .actions-menu-button,
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

    .actions-menu-button:hover,
    .panel-header .close-button:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.1);
    }

    .actions-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: #2a2a2a;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 8px;
      z-index: 10;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .actions-dropdown button {
      width: 100%;
      padding: 10px 12px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      text-align: left;
      transition: background-color 0.2s;
    }
    .actions-dropdown button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .actions-dropdown button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: transparent;
    }

    .panel-body {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 24px;
      padding-top: 0;
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

    .preview-container {
      margin-bottom: 16px;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .preview-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    gdm-video-player {
      width: 100%;
      height: 100%;
    }
    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #fff;
    }

    .tab-nav {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
      margin-top: 16px;
    }
    .tab-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px; /* Overlap the container border */
      transition: all 0.2s;
    }
    .tab-button svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    .tab-button:hover {
      color: #fff;
    }
    .tab-button.active {
      color: #5078ff;
      border-bottom-color: #5078ff;
    }

    .tab-content {
      flex-grow: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .analysis-text-content,
    .workflow-json-container {
      flex-grow: 1;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      line-height: 1.6;
      color: #eee;
      margin-top: 16px;
    }

    .analysis-text-content {
      padding: 1px 16px;
    }

    .workflow-json-container {
      position: relative;
      padding: 0;
    }

    .workflow-json-container pre {
      padding: 16px;
      margin: 0;
      height: 100%;
      overflow-y: auto;
      box-sizing: border-box;
    }

    .workflow-json-container code {
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .json-copy-button {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
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

    @media (max-width: 800px) {
      .panel-header {
        padding: 16px;
        padding-bottom: 0;
      }
      .panel-body {
        padding: 16px;
        padding-top: 0;
      }
    }
  `;

  private _handleOutsideClick = (e: MouseEvent) => {
    if (
      !this.isActionsMenuOpen ||
      e
        .composedPath()
        .includes(this.shadowRoot!.querySelector('.actions-menu-container')!)
    ) {
      return;
    }
    this.isActionsMenuOpen = false;
  };

  private dataUriToBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeString});
  }

  private revokePdfBlobUrl() {
    if (this.pdfBlobUrl) {
      URL.revokeObjectURL(this.pdfBlobUrl);
      this.pdfBlobUrl = null;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleOutsideClick);
    this.revokePdfBlobUrl();
  }

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
      this.activeTab = 'analysis'; // Reset on new analyses
    }

    const currentAnalysis = this.getCurrentAnalysis();
    const previewData = currentAnalysis?.previewData;

    if (previewData !== this.lastProcessedPreviewData) {
      this.lastProcessedPreviewData = previewData;
      this.revokePdfBlobUrl();

      if (previewData?.startsWith('data:application/pdf')) {
        const blob = this.dataUriToBlob(previewData);
        this.pdfBlobUrl = URL.createObjectURL(blob);
      }
    }

    if (changedProperties.has('isActionsMenuOpen')) {
      if (this.isActionsMenuOpen) {
        document.addEventListener('click', this._handleOutsideClick);
      } else {
        document.removeEventListener('click', this._handleOutsideClick);
      }
    }
  }

  private _close() {
    this.dispatchEvent(
      new CustomEvent('close', {bubbles: true, composed: true}),
    );
  }

  private toggleActionsMenu() {
    this.isActionsMenuOpen = !this.isActionsMenuOpen;
  }

  private _handleAnalysisSelectionChange(e: Event) {
    const selectElement = e.target as HTMLSelectElement;
    this.selectedAnalysisId = selectElement.value;
    this.activeTab = 'analysis'; // Reset tab on change
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

  private async copyAnalysis() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return;

    try {
      await navigator.clipboard.writeText(currentAnalysis.summary);
    } catch (err) {
      console.error('Falha ao copiar o texto: ', err);
      // O botão reverterá para o estado 'idle' em caso de falha.
      throw err;
    }
  }

  private async copyWorkflowJson(workflowJson: object) {
    if (!workflowJson) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(workflowJson, null, 2),
      );
    } catch (err) {
      console.error('Falha ao copiar o JSON: ', err);
      throw err;
    }
  }

  private renderDefaultAnalysis(analysis: Analysis) {
    return html`
      <div id="analysis-content-for-pdf" class="analysis-text-content">
        ${unsafeHTML(marked.parse(analysis.summary) as string)}
      </div>
    `;
  }

  private renderWorkflowTabs(analysis: Analysis) {
    let summaryMarkdown = 'Nenhum resumo fornecido.';
    let workflowJson = {};
    let parseError = false;

    try {
      const parsed = JSON.parse(analysis.summary);
      if (parsed.summary_base64) {
        // Handle potential Unicode characters in the markdown
        summaryMarkdown = decodeURIComponent(escape(atob(parsed.summary_base64)));
      } else if (parsed.summary) { // Fallback for old format
        summaryMarkdown = parsed.summary;
      }
      workflowJson = parsed.workflow_json || {};
    } catch (e) {
      console.error('Falha ao analisar o resumo do fluxo de trabalho JSON:', e);
      parseError = true;
      // Show the raw content if parsing fails
      summaryMarkdown = analysis.summary;
    }

    if (parseError) {
      return html`
        <div id="analysis-content-for-pdf" class="analysis-text-content">
          <p>
            <strong
              >Erro ao processar a análise do fluxo de trabalho.</strong
            >
          </p>
          <pre><code>${summaryMarkdown}</code></pre>
        </div>
      `;
    }

    return html`
      <div class="tab-nav">
        <button
          class="tab-button ${this.activeTab === 'analysis' ? 'active' : ''}"
          @click=${() => (this.activeTab = 'analysis')}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            viewBox="0 -960 960 960"
            width="20px"
            fill="currentColor">
            <path
              d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z" />
          </svg>
          <span>Análise</span>
        </button>
        <button
          class="tab-button ${this.activeTab === 'json' ? 'active' : ''}"
          @click=${() => (this.activeTab = 'json')}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            viewBox="0 -960 960 960"
            width="20px"
            fill="currentColor">
            <path
              d="m321-240-57-57 179-179-179-179 57-57 236 236-236 236Zm318 0-57-57 179-179-179-179 57-57 236 236-236 236Z" />
          </svg>
          <span>Template N8N</span>
        </button>
      </div>
      <div class="tab-content">
        ${
          this.activeTab === 'analysis'
            ? html`
                <div
                  id="analysis-content-for-pdf"
                  class="analysis-text-content">
                  ${unsafeHTML(marked.parse(summaryMarkdown) as string)}
                </div>
              `
            : html`
                <div class="workflow-json-container">
                  <gdm-button-copy
                    class="json-copy-button"
                    .onCopy=${() => this.copyWorkflowJson(workflowJson)}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="18px"
                      viewBox="0 -960 960 960"
                      width="18px"
                      fill="currentColor">
                      <path
                        d="M320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z" />
                    </svg>
                    <span>Copiar JSON</span>
                  </gdm-button-copy>
                  <pre><code>${JSON.stringify(
                    workflowJson,
                    null,
                    2,
                  )}</code></pre>
                </div>
              `
        }
      </div>
    `;
  }

  render() {
    const currentAnalysis = this.getCurrentAnalysis();
    const analysisType = currentAnalysis?.type;
    const previewData = currentAnalysis?.previewData;
    const isImagePreview = previewData?.startsWith('data:image/');
    const isPdfPreview = previewData?.startsWith('data:application/pdf');
    const isHtmlPreview = previewData?.startsWith('data:text/html');

    const iframeProps: {src?: string; srcdoc?: string} = {};
    if (isPdfPreview) {
      iframeProps.src = this.pdfBlobUrl ?? '';
    } else if (isHtmlPreview && previewData) {
      const base64 = previewData.split(',')[1];
      try {
        iframeProps.srcdoc = decodeURIComponent(escape(atob(base64)));
      } catch (e) {
        console.error('Failed to decode base64 HTML for srcdoc', e);
        iframeProps.srcdoc = '<p>Error displaying preview.</p>';
      }
    }

    return html`
      <div class="panel-header">
        <h3>Análises de Conteúdo</h3>
        <div class="header-controls">
          <div class="actions-menu-container">
            <button
              class="actions-menu-button"
              @click=${this.toggleActionsMenu}
              ?disabled=${!currentAnalysis}
              title="Ações"
              aria-label="Ações">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 -960 960 960"
                width="24px"
                fill="currentColor">
                <path
                  d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z" />
              </svg>
            </button>
            ${
              this.isActionsMenuOpen
                ? html`
                    <div class="actions-dropdown">
                      <gdm-button-copy .onCopy=${this.copyAnalysis.bind(this)}>
                        <span>Copiar</span>
                      </gdm-button-copy>
                      <button @click=${this.downloadPdf}>
                        ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320v80H240v640h480v-400h80v400q0 33-23.5 56.5T720-80H240Zm420-520v-280l280 280h-280Z" /></svg>`}
                        <span>PDF</span>
                      </button>
                      <button @click=${this.downloadMarkdown}>
                        ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-320 280-520l56-56 104 104v-328h80v328l104-104 56 56-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" /></svg>`}
                        <span>MD</span>
                      </button>
                      <button @click=${this.shareAnalysis}>
                        ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-14.5L323-400q-21 15-47.5 23T220-360q-50 0-85-35t-35-85q0-50 35-85t85-35q30 0 56.5 10.5T323-560l281-171q-1-5-1.5-11.5T602-760q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-28 0-53.5-9.5T620-640L340-468q1 7 1.5 13.5t.5 14.5q0 7-1 14.5t-3 14.5l281 171q21-14 47-21.5t54-7.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-640q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720ZM220-440q17 0 28.5-11.5T260-480q0-17-11.5-28.5T220-520q-17 0-28.5 11.5T180-480q0 17 11.5 28.5T220-440Zm500 280q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160Z" /></svg>`}
                        <span>Compartilhar</span>
                      </button>
                    </div>
                  `
                : ''
            }
          </div>
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
                        (analysis) =>
                          html`
                            <option value=${analysis.id}>
                              ${analysis.title}
                            </option>
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
          ${
            previewData
              ? html`
                  <div class="preview-container">
                    ${analysisType === 'youtube' ||
                    analysisType === 'video' ||
                    analysisType === 'workflow'
                      ? html`
                          <gdm-video-player
                            .src=${previewData}></gdm-video-player>
                        `
                      : isImagePreview
                      ? html`
                          <img
                            class="preview-image"
                            src=${previewData}
                            alt="Preview of ${currentAnalysis.title}" />
                        `
                      : isPdfPreview || isHtmlPreview
                      ? html`<iframe
                          class="preview-iframe"
                          .src=${iframeProps.src}
                          .srcdoc=${iframeProps.srcdoc}
                          title="Preview of ${currentAnalysis.title}"></iframe>`
                      : ''}
                  </div>
                `
              : ''
          }
          ${
            currentAnalysis
              ? currentAnalysis.type === 'workflow'
                ? this.renderWorkflowTabs(currentAnalysis)
                : this.renderDefaultAnalysis(currentAnalysis)
              : html`<div class="analysis-text-content">
                  <p>Nenhuma análise selecionada.</p>
                </div>`
          }
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