/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html, svg} from 'lit';
import {customElement, property} from 'lit/decorators.js';

/**
 * A floating toolbar for rich text editing that appears on text selection.
 */
@customElement('gdm-rich-text-toolbar')
export class GdmRichTextToolbar extends LitElement {
  @property({type: Boolean, reflect: true}) show = false;
  @property({type: Number}) top = 0;
  @property({type: Number}) left = 0;

  static styles = css`
    :host {
      display: none;
      position: fixed;
      z-index: 1001;
      /* Center horizontally above the selection */
      transform: translate(-50%, -100%);
      margin-top: -10px; /* Gap between selection and toolbar */
      transition: opacity 0.15s ease-out, transform 0.15s ease-out;
      opacity: 0;
      will-change: top, left, opacity;
    }
    :host([show]) {
      display: block;
      opacity: 1;
      transform: translate(-50%, -100%) translateY(0);
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #1e1e1e;
      padding: 6px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(5px);
    }

    button {
      background: none;
      border: none;
      color: #ccc;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s, color 0.2s;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .separator {
      width: 1px;
      height: 20px;
      background: rgba(255, 255, 255, 0.2);
      margin: 0 4px;
    }
  `;

  private _format(command: string) {
    this.dispatchEvent(
      new CustomEvent('format', {
        detail: {command},
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const icons = {
      bold: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M420-200v-560h207q53 0 90 34t37 86q0 42-26 73t-72 41q60 12 96 55.5T800-320q0 63-40.5 101.5T640-180H476v-20h-56Zm80-480h124q21 0 34.5-12t13.5-32q0-20-13.5-32t-34.5-12H500v88Zm0 320h146q28 0 46-17t18-43q0-26-18-43t-46-17H500v120Z"/></svg>`,
      italic: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M320-200v-80h100l120-400H440v-80h320v80H660l-120 400h100v80H320Z"/></svg>`,
      underline: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M200-120v-80h560v80H200Zm280-240q-109 0-184.5-75.5T220-620v-220h80v220q0 75 52.5 127.5T480-240q75 0 127.5-52.5T660-420v-220h80v220q0 109-75.5 184.5T480-240Z"/></svg>`,
      justifyLeft: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M120-200v-80h400v80H120Zm0-240v-80h720v80H120Zm0-240v-80h720v80H120Z"/></svg>`,
      justifyCenter: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M240-200v-80h480v80H240Zm-120-240v-80h720v80H120Zm120-240v-80h480v80H240Z"/></svg>`,
      justifyRight: svg`<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M440-200v-80h400v80H440ZM120-440v-80h720v80H120Zm0-240v-80h720v80H120Z"/></svg>`,
    };

    return html`
      <div
        class="toolbar"
        style="top: ${this.top}px; left: ${this.left}px;"
        @mousedown=${(e: MouseEvent) => e.preventDefault()}>
        <button @click=${() => this._format('bold')} title="Negrito">
          ${icons.bold}
        </button>
        <button @click=${() => this._format('italic')} title="Itálico">
          ${icons.italic}
        </button>
        <button @click=${() => this._format('underline')} title="Sublinhado">
          ${icons.underline}
        </button>
        <div class="separator"></div>
        <button @click=${() => this._format('justifyLeft')} title="Alinhar à Esquerda">
          ${icons.justifyLeft}
        </button>
        <button @click=${() => this._format('justifyCenter')} title="Centralizar">
          ${icons.justifyCenter}
        </button>
        <button @click=${() => this._format('justifyRight')} title="Alinhar à Direita">
          ${icons.justifyRight}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-rich-text-toolbar': GdmRichTextToolbar;
  }
}
