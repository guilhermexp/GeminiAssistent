/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

/**
 * A shell component that manages the main layout of the application, including a
 * collapsible and resizable side panel for analysis content.
 */
@customElement('gdm-assistant-shell')
export class AssistantShell extends LitElement {
  /**
   * Controls whether the analysis panel is visible.
   */
  @property({type: Boolean, reflect: true}) panelOpen = false;

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .analysis-panel-container {
      flex-shrink: 0;
      overflow: hidden;
      /* Default open state */
      width: 50%;
      min-width: 300px;
      max-width: calc(100% - 200px); /* Leave space for the main view */
      position: relative;
      transition: width 0.3s ease, min-width 0.3s ease;
    }

    /* Hide panel and resizer when not open */
    :host(:not([panelOpen])) .analysis-panel-container,
    :host(:not([panelOpen])) .resizer {
      width: 0;
      min-width: 0;
      border: none;
      pointer-events: none;
      opacity: 0;
    }

    .resizer {
      width: 8px;
      flex-shrink: 0;
      background: transparent;
      cursor: col-resize;
      position: relative;
      transition: opacity 0.3s ease;
      z-index: 1; /* Ensure it's on top */
    }

    .resizer::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 2px;
      height: 40px;
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      transition: background-color 0.2s ease;
    }

    .resizer:hover::before,
    .resizer.is-resizing::before {
      background-color: #5078ff;
    }

    .assistant-view-container {
      flex-grow: 1;
      position: relative;
      height: 100%;
      overflow: hidden;
      min-width: 200px; /* Ensure main view is always visible */
    }

    /* Disable transitions during resize for smooth dragging */
    :host(.is-resizing) .analysis-panel-container,
    :host(.is-resizing) .assistant-view-container {
      transition: none;
    }
  `;

  updated(changedProperties: Map<string, unknown>) {
    // When the panel is closed, we must remove any inline width style
    // that was applied by the resizer. This allows the CSS to correctly
    // collapse the panel to width: 0.
    if (changedProperties.has('panelOpen') && !this.panelOpen) {
      const panelContainer = this.shadowRoot?.querySelector(
        '.analysis-panel-container',
      ) as HTMLElement;
      if (panelContainer) {
        panelContainer.style.width = '';
      }
    }
  }

  private handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const resizer = e.currentTarget as HTMLElement;
    resizer.classList.add('is-resizing');
    this.classList.add('is-resizing'); // Add class to host for disabling transitions

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp, {once: true});
  };

  private handleMouseMove = (e: MouseEvent) => {
    const panelContainer = this.shadowRoot?.querySelector(
      '.analysis-panel-container',
    ) as HTMLElement;
    if (!panelContainer) return;

    const hostRect = this.getBoundingClientRect();
    const newWidth = e.clientX - hostRect.left;

    // The browser will respect the min-width and max-width from the CSS
    panelContainer.style.width = `${newWidth}px`;
  };

  private handleMouseUp = () => {
    this.classList.remove('is-resizing');
    const resizer = this.shadowRoot?.querySelector('.resizer') as HTMLElement;
    if (resizer) {
      resizer.classList.remove('is-resizing');
    }

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', this.handleMouseMove);
  };

  render() {
    return html`
      <div class="analysis-panel-container">
        <slot name="analysis-panel"></slot>
      </div>
      <div class="resizer" @mousedown=${this.handleMouseDown}></div>
      <div class="assistant-view-container">
        <slot name="assistant-view"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-assistant-shell': AssistantShell;
  }
}
