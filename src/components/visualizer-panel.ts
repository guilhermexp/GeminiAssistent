/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, PropertyValueMap} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {Analysis, ChatMessage} from '../types/types.js';
import './video-player.js';
import './chat-panel.js';

@customElement('gdm-visualizer-panel')
export class GdmVisualizerPanel extends LitElement {
  @property({type: Boolean}) show = false;
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: String}) selectedAnalysisId: string | null = null;
  @property({type: Array}) chatHistory: ChatMessage[] = [];
  @property({type: Boolean}) isChatting = false;

  @state() private pdfBlobUrl: string | null = null;
  @state() private activeTab: 'preview' | 'chat' = 'preview';
  private lastProcessedPreviewData: string | undefined = undefined;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #2a2a2a;
      color: #eee;
      font-family: sans-serif;
      overflow: hidden;
      box-sizing: border-box;
      border-radius: 0;
    }

    .panel-container {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 16px;
    }

    .current-analysis-pill-container {
      flex-shrink: 0;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 12px;
    }
    .content-pill {
      display: inline-flex;
      align-items: center;
      background: rgba(0, 0, 0, 0.4);
      padding: 6px 12px;
      border-radius: 16px;
      font-family: sans-serif;
      font-size: 13px;
      color: #eee;
      border: 1px solid #5078ff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .content-pill span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .content-pill button {
      background: none;
      border: none;
      color: #aaa;
      margin-left: 8px;
      padding: 0;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      display: flex;
      align-items: center;
    }
    .content-pill button:hover {
      color: #fff;
    }

    .tab-buttons {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .tab-button {
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid transparent;
      color: #ccc;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .tab-button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .tab-button.active {
      background: transparent;
      border-color: #5078ff;
      color: #fff;
    }
    .tab-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: rgba(255, 255, 255, 0.02);
    }

    .content-area {
      flex-grow: 1;
      overflow: hidden;
      margin-top: 12px;
      display: flex;
      flex-direction: column;
    }

    .preview-container {
      width: 100%;
      aspect-ratio: 16 / 9;
      flex-shrink: 0;
      background: transparent;
      position: relative;
      border-radius: 12px;
      overflow: hidden;
    }
    .preview-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .preview-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #fff;
    }

    .tags-section {
      margin-top: auto; /* Push tags to the bottom */
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }
    .tags-title {
      font-size: 12px;
      font-weight: 600;
      color: #aaa;
      text-transform: uppercase;
      margin: 0 0 12px 0;
    }
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tag-pill {
      background: rgba(255, 255, 255, 0.1);
      color: #ccc;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
    }
  `;

  private _removeAnalysis(idToRemove: string) {
    this.dispatchEvent(
      new CustomEvent('analysis-remove', {
        detail: {idToRemove},
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getCurrentAnalysis(): Analysis | undefined {
    return this.analyses.find((a) => a.id === this.selectedAnalysisId);
  }

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
    this.revokePdfBlobUrl();
  }

  updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
    const currentAnalysis = this.getCurrentAnalysis();
    const previewData = currentAnalysis?.previewData;

    if (changedProperties.has('selectedAnalysisId')) {
      // When a new analysis is selected, decide which tab to show.
      this.activeTab = previewData ? 'preview' : 'chat';
    }

    if (previewData !== this.lastProcessedPreviewData) {
      this.lastProcessedPreviewData = previewData;
      this.revokePdfBlobUrl();

      if (previewData?.startsWith('data:application/pdf')) {
        const blob = this.dataUriToBlob(previewData);
        this.pdfBlobUrl = URL.createObjectURL(blob);
      }
    }
  }

  renderPreview(analysis: Analysis) {
    const previewData = analysis.previewData;
    if (!previewData) return html``;

    let previewContent;

    if (
      analysis.type === 'youtube' ||
      analysis.type === 'video' ||
      analysis.type === 'workflow'
    ) {
      previewContent = html`<gdm-video-player
        .src=${previewData}></gdm-video-player>`;
    } else if (previewData.startsWith('data:image/')) {
      previewContent = html`<img
        class="preview-image"
        src=${previewData}
        alt="Preview of ${analysis.title}" />`;
    } else if (previewData.startsWith('data:application/pdf')) {
      previewContent = html`<iframe
        class="preview-iframe"
        src=${this.pdfBlobUrl ?? ''}
        title="Preview of ${analysis.title}"></iframe>`;
    } else if (previewData.startsWith('data:text/html')) {
      const base64 = previewData.split(',')[1];
      let docContent = '<p>Error displaying preview.</p>';
      try {
        docContent = decodeURIComponent(escape(atob(base64)));
      } catch (e) {
        console.error('Failed to decode base64 HTML for srcdoc', e);
      }
      previewContent = html`<iframe
        class="preview-iframe"
        .srcdoc=${docContent}
        title="Preview of ${analysis.title}"></iframe>`;
    } else if (analysis.type === 'url' || analysis.type === 'github') {
      previewContent = html`<iframe
        class="preview-iframe"
        src=${previewData}
        title="Preview of ${analysis.title}"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"></iframe>`;
    }

    return html`<div class="preview-container">${previewContent}</div>`;
  }

  render() {
    const currentAnalysis = this.getCurrentAnalysis();
    if (!currentAnalysis) return html``;

    return html`
      <div class="panel-container">
        <div class="current-analysis-pill-container">
          <div class="content-pill" title=${currentAnalysis.source}>
            <span>${currentAnalysis.title}</span>
            <button
              @click=${() => this._removeAnalysis(currentAnalysis.id)}
              title="Remover contexto"
              aria-label="Remover ${currentAnalysis.title} do contexto">
              ×
            </button>
          </div>
        </div>

        <div class="tab-buttons">
          <button
            class="tab-button ${this.activeTab === 'preview' ? 'active' : ''}"
            @click=${() => (this.activeTab = 'preview')}
            ?disabled=${!currentAnalysis.previewData}>
            Pré-visualização
          </button>
          <button
            class="tab-button ${this.activeTab === 'chat' ? 'active' : ''}"
            @click=${() => (this.activeTab = 'chat')}>
            Conversar
          </button>
        </div>

        <div class="content-area">
          ${this.activeTab === 'preview'
            ? this.renderPreview(currentAnalysis)
            : html`<gdm-chat-panel
                .chatHistory=${this.chatHistory}
                ?isChatting=${this.isChatting}></gdm-chat-panel>`}
        </div>

        ${currentAnalysis.tags && currentAnalysis.tags.length > 0
          ? html`
              <div class="tags-section">
                <h4 class="tags-title">Tópicos</h4>
                <div class="tags-container">
                  ${currentAnalysis.tags.map(
                    (tag) => html`<span class="tag-pill">${tag}</span>`,
                  )}
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}
