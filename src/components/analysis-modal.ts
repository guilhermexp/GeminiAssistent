/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {when} from 'lit/directives/when.js';
import {marked} from 'marked';
import TurndownService from 'turndown';
import {debounce} from '../utils/utils';
import type {Analysis} from '../types/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './copy-button.js';
import './rich-text-toolbar';
import type {GdmRichTextToolbar} from './rich-text-toolbar';

/**
 * A panel that displays the detailed analysis content.
 * It supports rendering Markdown, allows for live editing of the content,
 * and provides options to export the analysis.
 * NOTE: This component is named `gdm-analysis-panel` to match its usage,
 * but the filename is `analysis-modal.ts` for consistency with the project structure.
 */
@customElement('gdm-analysis-panel')
export class GdmAnalysisPanel extends LitElement {
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: String}) selectedAnalysisId: string | null = null;
  @query('.content-wrapper') private contentWrapper: HTMLDivElement | undefined;
  @query('gdm-rich-text-toolbar') private toolbar: GdmRichTextToolbar | undefined;

  @state() private toolbarPosition = {top: 0, left: 0};
  @state() private isToolbarVisible = false;

  private turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  private debouncedUpdate: (id: string) => void;

  constructor() {
    super();
    // Debounce the update function to avoid excessive updates during typing.
    this.debouncedUpdate = debounce((id: string) => {
      if (!this.contentWrapper) return;
      // Convert the edited HTML back to Markdown.
      const newSummary = this.turndownService.turndown(
        this.contentWrapper.innerHTML,
      );
      this.dispatchEvent(
        new CustomEvent('analysis-update', {
          detail: {id, summary: newSummary},
          bubbles: true,
          composed: true,
        }),
      );
    }, 500); // Wait for 500ms of inactivity before saving.
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('selectionchange', this.handleSelectionChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('selectionchange', this.handleSelectionChange);
  }

  private handleSelectionChange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (this.isToolbarVisible) this.isToolbarVisible = false;
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    // Ensure the selection is within this component's editable area
    const isInsideEditable = this.contentWrapper?.contains(
      range.commonAncestorContainer,
    );

    if (selectedText.trim() !== '' && isInsideEditable) {
      const rect = range.getBoundingClientRect();
      this.toolbarPosition = {
        top: rect.top,
        left: rect.left + rect.width / 2,
      };
      if (!this.isToolbarVisible) this.isToolbarVisible = true;
    } else {
      if (this.isToolbarVisible) this.isToolbarVisible = false;
    }
  };

  private handleFormat(e: CustomEvent<{command: string}>) {
    const {command} = e.detail;
    document.execCommand(command, false);
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      color: #e0e0e0;
      background: transparent;
    }

    .analysis-container {
      flex-grow: 1;
      overflow-y: auto;
      padding: 24px 32px;
      font-family: sans-serif;
    }

    .analysis-header {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .analysis-source {
      font-size: 14px;
      color: #aaa;
      word-break: break-all;
    }

    .analysis-title {
      font-size: 1.8em;
      font-weight: 600;
      margin: 8px 0 0 0;
      color: #fff;
    }

    .analysis-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .action-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background-color: rgba(255, 255, 255, 0.08);
      color: #ccc;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .action-button:hover {
      background-color: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .content-wrapper {
      outline: none;
      line-height: 1.7;
      caret-color: #5078ff;
      border: 2px solid transparent;
      border-radius: 8px;
      padding: 0 4px;
      margin: 0 -4px;
      transition: border-color 0.2s ease;
    }

    .content-wrapper:focus-within {
      border-color: rgba(80, 120, 255, 0.5);
    }

    /* Markdown styling */
    .content-wrapper h1,
    .content-wrapper h2,
    .content-wrapper h3 {
      color: #50a8ff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 8px;
      margin-top: 2em;
    }

    .content-wrapper a {
      color: #8ab4f8;
      text-decoration: none;
    }

    .content-wrapper a:hover {
      text-decoration: underline;
    }

    .content-wrapper code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
      word-break: break-word;
    }

    .content-wrapper pre {
      background: rgba(0, 0, 0, 0.4);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .content-wrapper pre code {
      padding: 0;
      background: none;
      border: none;
    }

    .content-wrapper blockquote {
      border-left: 4px solid #5078ff;
      padding-left: 16px;
      margin-left: 0;
      color: #ccc;
      font-style: italic;
    }

    .content-wrapper ul,
    .content-wrapper ol {
      padding-left: 24px;
    }

    .content-wrapper li {
      margin-bottom: 8px;
    }
  `;

  private handleInput() {
    const analysis = this.getSelectedAnalysis();
    if (analysis) {
      this.debouncedUpdate(analysis.id);
    }
  }

  private getSelectedAnalysis(): Analysis | undefined {
    if (!this.selectedAnalysisId) return undefined;
    return this.analyses.find((a) => a.id === this.selectedAnalysisId);
  }

  private async downloadAs(format: 'md' | 'pdf' | 'json') {
    const analysis = this.getSelectedAnalysis();
    if (!analysis) return;

    let content = '';
    let mimeType = '';
    let extension = '';

    if (format === 'md') {
      content = analysis.summary;
      mimeType = 'text/markdown';
      extension = 'md';
    } else if (format === 'json') {
      const exportObject =
        analysis.type === 'workflow'
          ? JSON.parse(analysis.summary)
          : {
              title: analysis.title,
              source: analysis.source,
              summary: analysis.summary,
            };
      content = JSON.stringify(exportObject, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else if (format === 'pdf' && this.contentWrapper) {
      this.dispatchEvent(new CustomEvent('export-start', {bubbles: true, composed: true}));
      try {
        const canvas = await html2canvas(this.contentWrapper, {
          backgroundColor: '#000000',
          scale: 2,
        });
        const imgData = canvas.toDataURL('image/png');
        const doc = new jsPDF('p', 'pt', 'a4');
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        doc.save(`${analysis.title || 'analysis'}.pdf`);
      } catch (e) {
        console.error("Error generating PDF", e);
      } finally {
        this.dispatchEvent(new CustomEvent('export-end', {bubbles: true, composed: true}));
      }
      return;
    }

    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.title || 'analysis'}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  render() {
    const analysis = this.getSelectedAnalysis();
    if (!analysis) {
      return html`
        <gdm-rich-text-toolbar
          ?show=${this.isToolbarVisible}
          .top=${this.toolbarPosition.top}
          .left=${this.toolbarPosition.left}
          @format=${this.handleFormat}>
        </gdm-rich-text-toolbar>
      `;
    }

    let summaryHtml = '';
    let workflowJsonString = '';

    if (analysis.type === 'workflow') {
      try {
        const parsed = JSON.parse(analysis.summary);
        if (parsed.summary_base64) {
          const markdownSummary = decodeURIComponent(
            escape(atob(parsed.summary_base64)),
          );
          summaryHtml = marked.parse(markdownSummary) as string;
        } else if (parsed.summary) {
          summaryHtml = marked.parse(parsed.summary) as string;
        }
        if (parsed.workflow_json) {
          workflowJsonString = JSON.stringify(parsed.workflow_json, null, 2);
        }
      } catch (e) {
        summaryHtml = '<p>Erro: O resumo do fluxo de trabalho está em um formato inválido.</p>';
        workflowJsonString = analysis.summary;
      }
    } else {
      summaryHtml = marked.parse(analysis.summary) as string;
    }

    return html`
      <gdm-rich-text-toolbar
        ?show=${this.isToolbarVisible}
        .top=${this.toolbarPosition.top}
        .left=${this.toolbarPosition.left}
        @format=${this.handleFormat}>
      </gdm-rich-text-toolbar>

      <div class="analysis-container" id="analysis-content-to-export">
        <div class="analysis-header">
          <p class="analysis-source">${analysis.source}</p>
          <h1 class="analysis-title">${analysis.title}</h1>
          <div class="analysis-actions">
            <button class="action-button" @click=${() => this.downloadAs('md')}>
              Exportar MD
            </button>
            <button class="action-button" @click=${() => this.downloadAs('pdf')}>
              Exportar PDF
            </button>
            ${when(
              analysis.type === 'workflow' || analysis.type === 'spreadsheet',
              () => html`
                <button
                  class="action-button"
                  @click=${() => this.downloadAs('json')}>
                  Exportar JSON
                </button>
              `,
            )}
            ${when(
              workflowJsonString,
              () => html`
                <gdm-button-copy
                  .onCopy=${() =>
                    navigator.clipboard.writeText(workflowJsonString)}>
                  Copiar JSON do Workflow
                </gdm-button-copy>
              `,
            )}
          </div>
        </div>
        <div
          class="content-wrapper"
          contenteditable="true"
          @input=${this.handleInput}>
          ${unsafeHTML(summaryHtml)}
        </div>
      </div>
    `;
  }
}
