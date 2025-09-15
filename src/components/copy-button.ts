/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import {LitElement, css, html, svg} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

@customElement('gdm-button-copy')
export class GdmButtonCopy extends LitElement {
  @property({attribute: false}) onCopy: () => Promise<void> | void;
  @property({type: Number}) duration = 2000;
  @property({type: Number}) loadingDuration = 500;
  @property({type: Boolean}) disabled = false;

  @state() private buttonState: 'idle' | 'loading' | 'success' = 'idle';

  static styles = css`
    .copy-button {
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

    .copy-button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
    }

    .copy-button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .icon-wrapper {
      position: relative;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .spinner {
      animation: spin 1s linear infinite;
    }
  `;

  private async handleClick() {
    if (this.buttonState !== 'idle' || !this.onCopy) return;

    this.buttonState = 'loading';
    try {
      await Promise.resolve(this.onCopy());
      setTimeout(() => {
        this.buttonState = 'success';
        setTimeout(() => {
          this.buttonState = 'idle';
        }, this.duration);
      }, this.loadingDuration);
    } catch (err) {
      console.error('Failed to copy:', err);
      this.buttonState = 'idle';
    }
  }

  render() {
    const icons = {
      idle: svg`<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z"/></svg>`,
      loading: svg`<svg class="spinner" xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880v80q-134 0-227 93t-93 227q0 134 93 227t227 93q134 0 227-93t93-227h-80q0 100-70 170t-170 70Z"/></svg>`,
      success: svg`<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>`,
    };

    return html`
      <button
        class="copy-button"
        ?disabled=${this.buttonState !== 'idle' || this.disabled}
        @click=${this.handleClick}>
        <div class="icon-wrapper">${icons[this.buttonState]}</div>
        <slot></slot>
      </button>
    `;
  }
}
