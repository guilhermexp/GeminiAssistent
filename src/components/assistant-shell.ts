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
   * Controls whether the sidebar is visible.
   */
  @property({type: Boolean, reflect: true}) sidebarOpen = false;

  /**
   * Controls whether the visualizer panel is visible.
   */
  @property({type: Boolean, reflect: true}) visualizerPanelOpen = false;

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .sidebar-container {
      flex-shrink: 0;
      width: 280px;
      min-width: 250px;
      max-width: 500px;
      position: relative;
      transition: width 0.3s ease, min-width 0.3s ease, transform 0.3s ease;
      padding: 0;
      box-sizing: border-box; /* Include padding in width */
    }

    .visualizer-panel-container {
      flex-shrink: 0;
      width: 450px;
      min-width: 250px;
      max-width: 800px;
      position: relative;
      transition: width 0.3s ease, min-width 0.3s ease, transform 0.3s ease,
        padding 0.3s ease;
      padding: 0;
      box-sizing: border-box; /* Include padding in width */
    }

    /* Hide panel and resizer when not open */
    :host(:not([sidebarOpen])) .sidebar-container,
    :host(:not([sidebarOpen])) .resizer.sidebar-resizer {
      width: 0;
      min-width: 0;
      border: none;
      pointer-events: none;
      opacity: 0;
      padding: 0; /* Collapse padding when hidden */
    }

    :host(:not([visualizerPanelOpen])) .visualizer-panel-container,
    :host(:not([visualizerPanelOpen])) .resizer.visualizer-resizer {
      width: 0;
      min-width: 0;
      border: none;
      pointer-events: none;
      opacity: 0;
      padding: 0; /* Collapse padding when hidden */
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
      background-color: #2a2a2a;
    }

    /* Disable transitions during resize for smooth dragging */
    :host(.is-resizing) .sidebar-container,
    :host(.is-resizing) .visualizer-panel-container,
    :host(.is-resizing) .assistant-view-container {
      transition: none;
    }

    /* Responsive adjustments for smaller screens */
    @media (max-width: 1024px) {
      .sidebar-container {
        width: 250px;
        min-width: 200px;
      }
      .visualizer-panel-container {
        width: 320px;
        min-width: 220px;
      }
    }

    @media (max-width: 768px) {
      .sidebar-container {
        width: 35%;
        min-width: 180px;
      }
      .visualizer-panel-container {
        width: 40%;
        min-width: 180px;
      }
      .assistant-view-container {
        min-width: 150px;
      }
      .resizer {
        display: none;
      }
    }
  `;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('sidebarOpen') && !this.sidebarOpen) {
      this.resetPanelStyle('.sidebar-container');
    }
    if (
      changedProperties.has('visualizerPanelOpen') &&
      !this.visualizerPanelOpen
    ) {
      this.resetPanelStyle('.visualizer-panel-container');
    }
  }

  private resetPanelStyle(selector: string) {
    const panelContainer = this.shadowRoot?.querySelector(
      selector,
    ) as HTMLElement;
    if (panelContainer) {
      panelContainer.style.width = '';
    }
  }

  private createResizeHandler(
    panelSelector: string,
    direction: 'left' | 'right',
  ) {
    return (e: MouseEvent) => {
      // Don't allow resizing on smaller screens where the layout is fixed
      if (window.innerWidth <= 768) return;

      e.preventDefault();
      const resizer = e.currentTarget as HTMLElement;
      resizer.classList.add('is-resizing');
      this.classList.add('is-resizing');

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const panelContainer = this.shadowRoot?.querySelector(
        panelSelector,
      ) as HTMLElement;
      if (!panelContainer) return;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const hostRect = this.getBoundingClientRect();
        let newWidth;
        if (direction === 'left') {
          newWidth = moveEvent.clientX - hostRect.left;
        } else {
          newWidth = hostRect.right - moveEvent.clientX;
        }
        panelContainer.style.width = `${newWidth}px`;
      };

      const handleMouseUp = () => {
        this.classList.remove('is-resizing');
        resizer.classList.remove('is-resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp, {once: true});
    };
  }

  render() {
    return html`
      <div class="sidebar-container">
        <slot name="sidebar"></slot>
      </div>
      <div
        class="resizer sidebar-resizer"
        @mousedown=${this.createResizeHandler('.sidebar-container', 'left')}></div>
      <div class="assistant-view-container">
        <slot name="assistant-view"></slot>
      </div>
      <div
        class="resizer visualizer-resizer"
        @mousedown=${this.createResizeHandler(
          '.visualizer-panel-container',
          'right',
        )}></div>
      <div class="visualizer-panel-container">
        <slot name="visualizer-panel"></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-assistant-shell': AssistantShell;
  }
}
