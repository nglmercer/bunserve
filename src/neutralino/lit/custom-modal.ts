import { LitElement, html, css } from 'lit';

interface DialogOption {
  label: string;
  class?: string;
  style?: string;
  callback?: (e: Event) => void;
}
export class DialogContent extends LitElement {
  static get properties() {
    return {
      title: { type: String, reflect: true },
      description: { type: String, reflect: true },
      theme: { type: String, reflect: true },
      options: { type: Array },
    };
  }

  title: string;
  description: string;
  theme: string;
  options: DialogOption[];

  constructor() {
    super();
    this.title = '';
    this.description = '';
    this.theme = 'light';
    this.options = [];
  }

  static get styles() {
    return css`
      :host {
        --dlg-padding: 1.5rem;
        --dlg-border-radius: 8px;
        --dlg-font-family: system-ui, -apple-system, sans-serif;
        --dlg-title-size: 1.5rem;
        --dlg-title-weight: 600;
        --dlg-desc-size: 1rem;
        --dlg-desc-opacity: 0.8;
        --dlg-desc-max-height: 500px;
        --dlg-button-padding: 0.5rem 1rem;
        --dlg-button-radius: 4px;
        --dlg-button-font-size: 0.875rem;
        --dlg-options-gap: 0.5rem;
        --dlg-slot-margin-top: 1rem;
        --dlg-transition-speed: 0.2s;

        --dlg-text-color: #1a1a1a;
        --dlg-border-color: #e5e5e5;
        --dlg-bg-color: #ffffff;
        --dlg-button-cancel-bg: #e5e5e5;
        --dlg-button-cancel-text: #1a1a1a;
        --dlg-button-cancel-hover-bg: #d9d9d9;

        --dlg-dark-text-color: #ffffff;
        --dlg-dark-border-color: #333333;
        --dlg-dark-bg-color: #2a2a2a;
        --dlg-dark-button-cancel-bg: #444444;
        --dlg-dark-button-cancel-text: #ffffff;
        --dlg-dark-button-cancel-hover-bg: #555555;

        --dlg-button-save-bg: #007bff;
        --dlg-button-save-text: white;
        --dlg-button-save-hover-bg: #0056b3;
        --dlg-button-delete-bg: #dc3545;
        --dlg-button-delete-text: white;
        --dlg-button-delete-hover-bg: #bd2130;

        display: block;
        font-family: var(--dlg-font-family);
      }

      .container {
        padding: var(--dlg-padding);
        border-radius: var(--dlg-border-radius);
        transition: background-color var(--dlg-transition-speed) ease, border-color var(--dlg-transition-speed) ease, color var(--dlg-transition-speed) ease;
        border: 1px solid var(--dlg-border-color);
        background-color: var(--dlg-bg-color);
        color: var(--dlg-text-color);
      }

      .container.dark {
        border-color: var(--dlg-dark-border-color);
        background-color: var(--dlg-dark-bg-color);
        color: var(--dlg-dark-text-color);
      }

      .title {
        font-size: var(--dlg-title-size);
        font-weight: var(--dlg-title-weight);
        margin: 0 0 0.5rem 0;
      }

      .description {
        font-size: var(--dlg-desc-size);
        opacity: var(--dlg-desc-opacity);
        max-height: var(--dlg-desc-max-height);
        overflow-y: auto;
        margin: 0 0 1rem 0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .options {
        display: flex;
        gap: var(--dlg-options-gap);
        flex-wrap: wrap;
        margin-top: var(--dlg-padding);
        justify-content: flex-end;
      }

      ::slotted(*) {
        display: block;
        margin-top: var(--dlg-slot-margin-top);
        margin-bottom: var(--dlg-slot-margin-top);
      }

      button {
        padding: var(--dlg-button-padding);
        border-radius: var(--dlg-button-radius);
        border: none;
        cursor: pointer;
        font-size: var(--dlg-button-font-size);
        font-family: inherit;
        transition: background-color var(--dlg-transition-speed) ease, opacity var(--dlg-transition-speed) ease;
        background-color: transparent;
        color: inherit;
        border: 1px solid transparent;
      }

      button:hover {
         opacity: 0.85;
      }

      .save-btn {
        background-color: var(--dlg-button-save-bg);
        color: var(--dlg-button-save-text);
        border-color: var(--dlg-button-save-bg);
      }
      .save-btn:hover {
        background-color: var(--dlg-button-save-hover-bg);
        border-color: var(--dlg-button-save-hover-bg);
        opacity: 1;
      }

      .cancel-btn {
        background-color: var(--dlg-button-cancel-bg);
        color: var(--dlg-button-cancel-text);
        border-color: var(--dlg-button-cancel-bg);
      }
      .cancel-btn:hover {
        background-color: var(--dlg-button-cancel-hover-bg);
        border-color: var(--dlg-button-cancel-hover-bg);
        opacity: 1;
      }
      .container.dark .cancel-btn {
        background-color: var(--dlg-dark-button-cancel-bg);
        color: var(--dlg-dark-button-cancel-text);
        border-color: var(--dlg-dark-button-cancel-bg);
      }
      .container.dark .cancel-btn:hover {
        background-color: var(--dlg-dark-button-cancel-hover-bg);
        border-color: var(--dlg-dark-button-cancel-hover-bg);
      }

      .delete-btn {
        background-color: var(--dlg-button-delete-bg);
        color: var(--dlg-button-delete-text);
        border-color: var(--dlg-button-delete-bg);
      }
      .delete-btn:hover {
        background-color: var(--dlg-button-delete-hover-bg);
        border-color: var(--dlg-button-delete-hover-bg);
        opacity: 1;
      }
    `;
  }

  render() {
    return html`
      <div class="container ${this.theme}">
        <h2 class="title">${this.title}</h2>
        <pre class="description">${this.description}</pre>
        <slot></slot>
        <div class="options">
          ${this.options.map((opt, i) => 
            html`<button 
              @click=${(e: Event) => this._handleOptionClick(e, i)}
              data-index="${i}"
              class="${opt.class || ''}"
              style="${opt.style || ''}"
            >${opt.label}</button>`
          )}
        </div>
      </div>
    `;
  }

  private _handleOptionClick(e: Event, index: number): void {
    if (this.options[index]?.callback && typeof this.options[index].callback === 'function') {
      this.options[index].callback!(e);
    } else {
      console.warn(`No valid callback found for option index ${index}`);
    }
  }
}

export class DialogContainer extends LitElement {
  static get properties() {
    return {
      visible: { type: Boolean, reflect: true },
      required: { type: Boolean, reflect: true }
    };
  }

  visible: boolean;
  required: boolean;

  constructor() {
    super();
    this.visible = false;
    this.required = false;
  }

  static get styles() {
    return css`
      :host {
        --dlg-overlay-bg: rgba(0, 0, 0, 0.5);
        --dlg-z-index: 1000;
        --dlg-transition-duration: 0.3s;
        --dlg-content-max-height: 90dvh;
        --dlg-content-border-radius: 16px;
        --dlg-content-padding: 8px;
        --dlg-content-bg: inherit;
        --dlg-content-color: inherit;

        display: block;
        background: inherit;
        color: inherit;
      }

      .dlg-ov {
        position: fixed;
        inset: 0;
        background-color: var(--dlg-overlay-bg);

        display: flex;
        align-items: center;
        justify-content: center;

        z-index: var(--dlg-z-index);

        opacity: 0;
        visibility: hidden;

        transition: opacity var(--dlg-transition-duration) ease,
                    visibility var(--dlg-transition-duration) ease;
      }

      .dlg-cnt {
        max-height: var(--dlg-content-max-height);
        overflow-y: auto;

        background: var(--dlg-content-bg);
        color: var(--dlg-content-color);
        border-radius: var(--dlg-content-border-radius);
        padding: var(--dlg-content-padding);

        transform: scale(0.95);
        transition: transform var(--dlg-transition-duration) ease;
        transition-property: transform;
      }

      .dlg-ov.visible {
        opacity: 1;
        visibility: visible;
      }

      .dlg-ov.visible .dlg-cnt {
        transform: scale(1);
      }
    `;
  }

  render() {
    return html`
      <div class="dlg-ov ${this.visible ? 'visible' : ''}" @click="${this._handleOverlayClick}">
        <div class="dlg-cnt">
          <slot></slot>
        </div>
      </div>
    `;
  }

  private _handleOverlayClick(e: Event): void {
    if (e.target === e.currentTarget && !this.required) {
      this.hide();
      this.emitClose();
    }
  }

  emitClose(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }
}

customElements.define('dialog-content', DialogContent);
customElements.define('dialog-container', DialogContainer);