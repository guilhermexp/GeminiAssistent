/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, svg} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {Analysis, ProcessingState} from '../types/types';

@customElement('gdm-analysis-form')
export class GdmAnalysisForm extends LitElement {
  @property({type: Array}) analyses: Analysis[] = [];
  @property({type: Object}) processingState: ProcessingState = {
    active: false,
    step: '',
    progress: 0,
  };

  @state() private urlInput = '';
  @state() private selectedFile: File | null = null;
  @state() private animatedProgress = 0;
  @state() private isModeMenuOpen = false;
  @state() private selectedMode: 'default' | 'vibecode' | 'workflow' =
    'default';
  private progressAnimationId: number | null = null;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      position: relative;
    }

    .analysis-form-container {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      height: 40px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding-left: 18px;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }

    .analysis-form-container:focus-within {
      border-color: rgba(255, 255, 255, 0.5);
    }

    input[type='text'] {
      flex-grow: 1;
      border: none;
      background: transparent;
      color: white;
      font-size: 13px;
      outline: none;
      height: 100%;
      padding-right: 5px;
    }

    .button-group {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 100%;
      padding-right: 4px;
    }

    .button-group button {
      height: 32px;
      border-radius: 16px;
      outline: none;
      border: none;
      color: #ccc;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    .button-group button.icon-button {
      width: 32px;
      padding: 0;
      flex-shrink: 0;
    }

    .button-group button.icon-button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .button-group button[type='submit'] {
      background: #3c3c62;
      color: white;
      padding: 0 18px;
      font-weight: 500;
      font-size: 13px;
      position: relative;
      overflow: hidden;
    }

    .button-group button[type='submit']:hover:not(:disabled) {
      background: #5078ff;
    }

    .button-group button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    button[type='submit']:disabled {
      background: #282846 !important;
      color: #aaa !important;
    }

    .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: linear-gradient(
        90deg,
        rgba(80, 120, 255, 0.7) 0%,
        rgba(100, 140, 255, 0.9) 100%
      );
      transition: none; /* JS will handle animation */
      z-index: 1;
    }

    .progress-text {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      color: white;
      width: 100%;
      overflow: hidden;
      padding: 0 8px;
      font-size: 11px;
    }

    .progress-text .loader {
      flex-shrink: 0;
      margin-right: 8px;
    }

    .progress-text .step-text {
      flex-grow: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
      min-width: 0;
    }

    .progress-text .progress-percent {
      flex-shrink: 0;
      margin-left: 8px;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .loader {
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      width: 14px;
      height: 14px;
      animation: spin 1s linear infinite;
    }

    .mode-selector-container {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mode-menu {
      position: absolute;
      top: calc(100% + 8px); /* Position dropdown below the button */
      right: 0;
      background: #2a2a2a;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 8px;
      z-index: 10;
      width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .mode-menu button {
      width: 100%;
      padding: 10px 12px;
      border-radius: 6px;
      border: 2px solid transparent;
      background: transparent;
      color: white;
      cursor: pointer;
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 12px;
      text-align: left;
      transition: all 0.2s;
    }
    .mode-menu button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .mode-menu button.active {
      background: rgba(255, 255, 255, 0.1);
    }
    .mode-icon-container {
      flex-shrink: 0;
      margin-top: 2px;
    }
    .mode-icon-container svg {
      width: 20px;
      height: 20px;
      display: block;
      opacity: 0.8;
    }
    .mode-menu button.active .mode-icon-container svg {
      opacity: 1;
    }
    .mode-text-container {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-grow: 1;
      min-width: 0; /* Allow text to wrap */
    }
    .mode-text-container strong {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
    }
    .mode-text-container span {
      font-size: 12px;
      color: #ccc;
      line-height: 1.4;
      white-space: normal;
      word-wrap: break-word;
    }

    @media (max-width: 480px) {
      .analysis-form-container {
        height: 36px;
        border-radius: 18px;
        padding-left: 14px;
      }
      input[type='text'] {
        font-size: 12px;
      }
      .button-group {
        gap: 2px;
        padding-right: 2px;
      }
      .button-group button {
        height: 28px;
        border-radius: 14px;
      }
      .button-group button.icon-button {
        width: 28px;
      }
      .button-group button[type='submit'] {
        padding: 0 14px;
        font-size: 12px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    document.body.addEventListener('click', this.handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.body.removeEventListener('click', this.handleOutsideClick);
  }

  private handleOutsideClick = (e: MouseEvent) => {
    const container = this.shadowRoot?.querySelector(
      '.mode-selector-container',
    );
    if (
      this.isModeMenuOpen &&
      container &&
      !e.composedPath().includes(container)
    ) {
      this.isModeMenuOpen = false;
    }
  };

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('processingState')) {
      this.handleProgressChange(
        this.processingState.progress,
        this.processingState.active,
      );
    }
  }

  private handleProgressChange(targetProgress: number, isActive: boolean) {
    // Always cancel any previous animation when the state changes.
    if (this.progressAnimationId) {
      cancelAnimationFrame(this.progressAnimationId);
      this.progressAnimationId = null;
    }

    // This is the special "intelligent feedback" state.
    // When the progress hits 50%, we start a long, slow, simulated animation
    // to show that work is being done in the background.
    if (isActive && targetProgress === 50) {
      // First, do a quick animation to get to the 50% mark.
      this.animateTo(50, 300).then(() => {
        // After reaching 50%, start the slow simulation, but only if the
        // process is still active at 50% (it hasn't been cancelled or completed).
        if (
          this.processingState.active &&
          this.processingState.progress === 50
        ) {
          // This will be a long, slow animation to 94% with an easing
          // function to make it feel more natural as it decelerates.
          const fifteenSeconds = 15000;
          const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
          this.animateTo(94, fifteenSeconds, easeOutCubic);
        }
      });
      return; // The nested animations will handle it from here.
    }

    // For all other progress steps, just do a quick, standard animation.
    this.animateTo(targetProgress, 300);
  }

  private animateTo(
    target: number,
    duration: number,
    easing: (t: number) => number = (t) => t,
  ): Promise<void> {
    return new Promise((resolve) => {
      // It's possible a new animation was requested while this one was waiting
      // in the promise, so we cancel again just in case.
      if (this.progressAnimationId) {
        cancelAnimationFrame(this.progressAnimationId);
      }

      const start = this.animatedProgress;
      const change = target - start;
      let startTime: number | null = null;

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progressRatio = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progressRatio);

        this.animatedProgress = Math.round(start + change * easedProgress);

        if (elapsed < duration) {
          this.progressAnimationId = requestAnimationFrame(step);
        } else {
          this.animatedProgress = target;
          this.progressAnimationId = null;
          resolve();
        }
      };

      this.progressAnimationId = requestAnimationFrame(step);
    });
  }

  private handleUrlInputChange(e: Event) {
    this.urlInput = (e.target as HTMLInputElement).value;
    if (this.selectedFile) {
      this.selectedFile = null;
      const fileInput = this.shadowRoot?.getElementById(
        'file-input',
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  }

  private triggerFileInput() {
    this.shadowRoot?.getElementById('file-input')?.click();
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.urlInput = this.selectedFile.name; // Show file name in input
    } else {
      this.selectedFile = null;
    }
  }

  private handleAnalysisSubmit(e: Event) {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('analysis-submit', {
        detail: {
          urlOrTopic: this.urlInput.trim(),
          file: this.selectedFile,
          analysisMode: this.selectedMode,
        },
        bubbles: true,
        composed: true,
      }),
    );
    // Clear inputs after submission
    this.urlInput = '';
    this.selectedFile = null;
    this.isModeMenuOpen = false;
    this.selectedMode = 'default';
    const fileInput = this.shadowRoot?.getElementById(
      'file-input',
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  private toggleModeMenu() {
    this.isModeMenuOpen = !this.isModeMenuOpen;
  }

  private selectMode(mode: 'default' | 'vibecode' | 'workflow') {
    this.selectedMode = mode;
    this.isModeMenuOpen = false;
  }

  render() {
    const icons = {
      default: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="m480-160-50-105-105-50 105-50 50-105 50 105 105 50-105 50Zm0 480-50-105-105-50 105-50 50-105 50 105 105 50-105 50Zm-280-280-50-105-105-50 105-50 50-105 50 105 105 50-105 50Z"/></svg>`,
      vibecode: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="m320-240-57-57 200-200-200-200 57-57 257 257-257 257Zm320 0-257-257 257-257 57 57-200 200 200 200-57 57Z"/></svg>`,
      workflow: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M280-280q-50 0-85-35t-35-85q0-50 35-85t85-35h120v-120q0-33 23.5-56.5T480-720q33 0 56.5 23.5T560-640v120h120q50 0 85 35t35 85q0 50-35 85t-85 35H560v120q0 33-23.5 56.5T480-200q-33 0-56.5-23.5T400-280v-120H280Zm0-80h400q17 0 28.5-11.5T720-400q0-17-11.5-28.5T680-440H280q-17 0-28.5 11.5T240-400q0 17 11.5 28.5T280-360Z"/></svg>`,
    };
    const modeIcon = () => {
      if (this.selectedMode === 'vibecode') return icons.vibecode;
      if (this.selectedMode === 'workflow') return icons.workflow;
      return icons.default;
    };
    return html`
      <form class="analysis-form-container" @submit=${this.handleAnalysisSubmit}>
        <input
          type="text"
          id="url-input"
          aria-label="URL, tópico de pesquisa ou nome do arquivo"
          placeholder="Cole uma URL, digite um tema ou carregue um arquivo"
          .value=${this.urlInput}
          @input=${this.handleUrlInputChange}
          ?disabled=${this.processingState.active} />
        <div class="button-group">
          <button
            type="button"
            class="icon-button"
            @click=${this.triggerFileInput}
            ?disabled=${this.processingState.active}
            title="Carregar um arquivo"
            aria-label="Carregar um arquivo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 -960 960 960"
              width="20px"
              fill="currentColor">
              <path
                d="M440-200h80v-167l64 64 56-57-160-160-160 160 56 57 64-64v167ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Z" />
            </svg>
          </button>
          <div class="mode-selector-container">
            <button
              type="button"
              class="icon-button mode-button"
              @click=${this.toggleModeMenu}
              ?disabled=${this.processingState.active}
              title="Selecionar modo de análise"
              aria-label="Selecionar modo de análise">
              ${modeIcon()}
            </button>
            ${
              this.isModeMenuOpen
                ? html`
                    <div class="mode-menu">
                      <button
                        class="mode-option ${this.selectedMode === 'default'
                          ? 'active'
                          : ''}"
                        @click=${() => this.selectMode('default')}>
                        <div class="mode-icon-container">${icons.default}</div>
                        <div class="mode-text-container">
                          <strong>Modo Padrão</strong>
                          <span
                            >Análise geral e abrangente do conteúdo
                            fornecido.</span
                          >
                        </div>
                      </button>
                      <button
                        class="mode-option ${this.selectedMode === 'vibecode'
                          ? 'active'
                          : ''}"
                        @click=${() => this.selectMode('vibecode')}>
                        <div class="mode-icon-container">
                          ${icons.vibecode}
                        </div>
                        <div class="mode-text-container">
                          <strong>Vibecode</strong>
                          <span
                            >Análise visual e funcional de apps (para
                            vídeos).</span
                          >
                        </div>
                      </button>
                      <button
                        class="mode-option ${this.selectedMode === 'workflow'
                          ? 'active'
                          : ''}"
                        @click=${() => this.selectMode('workflow')}>
                        <div class="mode-icon-container">
                          ${icons.workflow}
                        </div>
                        <div class="mode-text-container">
                          <strong>Workflow</strong>
                          <span
                            >Analisa fluxos de trabalho (n8n) e gera o
                            JSON.</span
                          >
                        </div>
                      </button>
                    </div>
                  `
                : ''
            }
          </div>
          <button
            type="submit"
            aria-label="Analisar, Pesquisar ou Adicionar Contexto"
            ?disabled=${(!this.urlInput.trim() && !this.selectedFile) ||
            this.processingState.active}>
            ${
              this.processingState.active
                ? html`
                    <div
                      class="progress-bar"
                      style="width: ${this.animatedProgress}%"></div>
                    <div class="progress-text">
                      <div class="loader"></div>
                      <span
                        class="step-text"
                        title="${this.processingState.step}"
                        >${this.processingState.step}</span
                      >
                      <span class="progress-percent"
                        >${this.animatedProgress}%</span
                      >
                    </div>
                  `
                : 'Analisar'
            }
          </button>
        </div>
        <input
          type="file"
          id="file-input"
          style="display: none;"
          @change=${this.handleFileSelect}
          accept="image/*,video/*,application/pdf,.csv,.xls,.xlsx,.doc,.docx,.md,.xlm" />
      </form>
    `;
  }
}