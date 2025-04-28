import { LitElement, html, css, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { map } from 'lit/directives/map.js';

// Define interfaces for options
interface Option {
    value: string;
    label: string;
}

// Define input types
type InputType = 'text' | 'textarea' | 'select' | 'checkbox' | 'switch' | 'boolean' | 'radio' |
    'number' | 'email' | 'password' | 'tel' | 'url' | 'date' | 'time' | 'datetime-local' | 'string' | 'File' | 'color' | 'range';
type InputReturnType = string | boolean | number | string[] | null | undefined | object;

function safeParse(value: InputReturnType): InputReturnType {
    if (value == null || typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
        return value;
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        try {
            const fixedJson = trimmed
                .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
                .replace(/:\s*'([^']+)'/g, ': "$1"');
            return JSON.parse(fixedJson);
        } catch (error) {
            console.error("Error al parsear JSON:", error, "Valor recibido:", value);
            return value;
        }
    }
}


export class CInput extends LitElement {
    // Properties with decorators
    @property({ type: String, reflect: true }) type: InputType = 'text';
    @property({ type: String, reflect: true }) name?: string;
    @property({ type: String }) value: string = '';
    @property({ type: String, reflect: true }) placeholder?: string;
    @property({ type: Boolean, reflect: true }) disabled: boolean = false;
    @property({ type: Boolean, reflect: true }) readonly: boolean = false;
    @property({ type: Boolean, reflect: true }) darkmode: boolean = false;
    @property({ type: Array }) options: Option[] = [];
    @property({ type: Boolean, reflect: true }) required: boolean = false;
    @property({ type: String, reflect: true }) pattern?: string;
    @property({ type: Boolean, reflect: true }) multiple: boolean = false;

    // Internal state properties
    @state() private _isValid: boolean = true;
    @state() private _internalValue: string | boolean | number | string[] | null = '';

    constructor() {
        super();
        // Constructor initialization is handled by the decorators above
    }

    // Handle attribute changes
    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
        super.attributeChangedCallback(name, oldVal, newVal);

        if (name === 'options' && newVal !== oldVal && typeof newVal === 'string') {
            try {
                const arrayOptions = safeParse(newVal);
                if (!Array.isArray(arrayOptions)) {
                    console.warn(`Options attribute for c-inp [${this.id || this.name}] is not an array`);
                }
                this.options = Array.isArray(arrayOptions) ? arrayOptions : [];
            } catch (e) {
                console.error(`Error parsing options attribute for c-inp [${this.id || this.name}]:`, e);
                this.options = [];
            }
        }

        if (name === 'value' && newVal !== oldVal) {
            this._internalValue = this._parseValueForInternal(newVal);
        }
    }

    // Update lifecycle hook
    willUpdate(changedProperties: PropertyValues): void {
        if (changedProperties.has('value')) {
            this._internalValue = this._parseValueForInternal(this.value);
        }

        if (changedProperties.has('multiple')) {
            const oldMultiple = changedProperties.get('multiple') as boolean;

            if (this.multiple && !oldMultiple && !Array.isArray(this._internalValue)) {
                // Changed to multiple: convert value to array if it's not
                this._internalValue = (this._internalValue !== null && this._internalValue !== undefined && this._internalValue !== '')
                    ? [String(this._internalValue)]
                    : [];
            } else if (!this.multiple && oldMultiple && Array.isArray(this._internalValue)) {
                // Changed to single: take first value or empty
                this._internalValue = this._internalValue.length > 0 ? this._internalValue[0] : '';
            }
        }
    }

    // Parse value for internal storage based on input type
    private _parseValueForInternal(val: string | null | undefined | string[] | boolean | number): string | boolean | number | string[] | null {
        if (this.multiple && this.type === 'select') {
            if (Array.isArray(val)) {
                return val.map(String);
            }

            if (typeof val === 'string') {
                try {
                    const parsed = JSON.parse(val);
                    return Array.isArray(parsed) ? parsed.map(String) : [];
                } catch (e) {
                    return val ? [String(val)] : [];
                }
            }

            return [];
        }

        if (this.type === 'checkbox' || this.type === 'switch' || this.type === 'boolean') {
            return String(val).toLowerCase() === 'true';
        }

        if (this.type === 'number') {
            return (val === '' || val === null || val === undefined) ? null : Number(val);
        }

        return val ?? '';
    }

    // CSS styles
    static styles = css`
    :host {
      display: block;
      margin: 0.5rem;
      padding: 0;
      color-scheme: light dark;
      /* Define variables default aquí para que se puedan sobreescribir */
      --inp-border-color: #ccc;
      --inp-disabled-bg: #f5f5f5;
      --inp-disabled-color: #888;
      --inp-slider-bg: #ccc;
      --inp-slider-knob: white;
    }
    
    :host([darkmode]) {
      /* Sobreescribe variables para dark mode */
      --inp-border-color: #555;
      --inp-disabled-bg: #222;
      --inp-disabled-color: #666;
      --inp-slider-bg: #555;
      --inp-slider-knob: #888;
    }

    .inp-cont {
      display: flex;
      flex-direction: column;
      padding: 0.5rem;
    }
    
    label {
      display: inline-flex;
      align-items: center;
      margin-right: 10px;
      cursor: pointer;
    }

    input, textarea, select {
      padding: 0.5rem;
      border: 1px solid var(--inp-border-color);
      border-radius: 4px;
      font-size: 14px;
      background-color: inherit;
      color: inherit;
      box-sizing: border-box;
      margin: 0;
    }
    
    option {
      color: slategray;
      background-color: #fff;
      text-indent: 0;
    }
    
    textarea { 
      resize: vertical; 
      min-height: 80px;
    }

    input:disabled, textarea:disabled, select:disabled {
      background-color: var(--inp-disabled-bg);
      cursor: not-allowed;
      color: var(--inp-disabled-color);
      border: 1px solid var(--inp-disabled-color);
    }
    
    input:read-only, textarea:read-only {
      background-color: var(--inp-disabled-bg);
      cursor: not-allowed;
      color: var(--inp-disabled-color);
    }

    .sw { position: relative; display: inline-block; width: 60px; height: 30px; }
    .sw input { opacity: 0; width: 0; height: 0; }
    .sldr { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--inp-slider-bg); transition: .4s; border-radius: 34px; }
    .sldr:before { position: absolute; content: ""; height: 22px; width: 22px; left: 4px; bottom: 4px; background-color: var(--inp-slider-knob); transition: .4s; border-radius: 50%; }
    input:checked + .sldr { background-color: #2196F3; }
    input:checked + .sldr:before { transform: translateX(28px); }
    
    input:not(:read-only):focus,
    textarea:not(:read-only):focus,
    select:focus {
      outline: none;
      border-color: #2196F3;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
      cursor: auto;
    }
    
    input:focus,
    textarea:focus,
    select:focus {
      outline: none;
    }
    
    select option:checked {
      background-color: rgb(0, 171, 255);
      color: white;
      font-weight: bold;
    }
    
    :host([invalid]) .input-element {
      border-color: red !important;
      box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.2) !important;
    }
  `;

    // Render method
    render() {
        this.toggleAttribute('invalid', !this._isValid);

        return html`
      <form class="val-form" @submit="${this._handleSubmit}" novalidate>
        <div class="inp-cont">
          ${this._renderInput()}
        </div>
        <button type="submit" style="display: none;"></button>
      </form>
    `;
    }

    // Render different input types
    private _renderInput() {
        const commonInputClass = 'input-element';

        switch (this.type) {
            case 'textarea':
                return html`<textarea
          class=${commonInputClass}
          id=${ifDefined(this.id)}
          name=${ifDefined(this.name)}
          .value=${this._internalValue === null ? '' : String(this._internalValue)}
          placeholder=${ifDefined(this.placeholder)}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          title=${ifDefined(this.title)}
          pattern=${ifDefined(this.pattern)}
          @change=${this._handleInputChange}
        ></textarea>`;

            case 'checkbox':
            case 'switch':
            case 'boolean':
                return html`
          <label class="sw">
            <input
              class=${commonInputClass}
              type="checkbox"
              id=${ifDefined(this.id)}
              name=${ifDefined(this.name)}
              .checked=${Boolean(this._internalValue)}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              ?required=${this.required}
              title=${ifDefined(this.title)}
              @change=${this._handleInputChange}
            >
            <span class="sldr"></span>
          </label>`;

            case 'select':
                return html`
        <select
          class=${commonInputClass}
          id=${ifDefined(this.id)}
          name=${ifDefined(this.name)}
          .value=${!this.multiple ? (this._internalValue === null ? '' : String(this._internalValue)) : undefined}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          title=${ifDefined(this.title)}
          @change=${this._handleInputChange}
          ?multiple=${this.multiple}
        >
          ${map(this.options, (opt) => {
                    const isSelected = this.multiple
                        ? Array.isArray(this._internalValue) && this._internalValue.includes(String(opt.value))
                        : String(opt.value) == String(this._internalValue ?? '');

                    return html`
              <option
                value=${opt.value}
                ?selected=${isSelected}
              >${opt.label}</option>
            `;
                })}
        </select>`;

            case 'radio':
                return html`
          ${map(this.options, (opt) => html`
            <label>
              <input type="radio"
                id=${`${this.id || this.name}_${opt.value}`}
                name=${ifDefined(this.name)}
                value=${opt.value}
                .checked=${opt.value == this._internalValue}
                ?disabled=${this.disabled}
                ?readonly=${this.readonly}
                ?required=${this.required}
                title=${ifDefined(this.title)}
                @change=${this._handleInputChange}
              >
              ${opt.label}
            </label>
          `)}
        `;

            default: // text, email, number, password, etc.
                return html`
          <input
            class=${commonInputClass}
            type=${this.type === 'string' ? 'text' : this.type}
            id=${ifDefined(this.id)}
            name=${ifDefined(this.name)}
            ${this.type.toLowerCase() !== 'file'
                ? html` .value=${this._internalValue === null ? '' : String(this._internalValue)} `
                : ''
              }
            placeholder=${ifDefined(this.placeholder)}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            ?required=${this.required}
            title=${ifDefined(this.title)}
            pattern=${ifDefined(this.pattern)}
            @change=${this._handleInputChange}
          >`;
        }
    }
    public EmitEvent(name: string, data: unknown) {
        this.dispatchEvent(new CustomEvent(name, {
            detail: data,
            bubbles: true,
            composed: true
        }));
    }
    // Event handlers and utility methods
    private _handleInputChange(evt: Event) {
        const inputElement = evt.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        let newValue: string | boolean | string[] | null;
        if (this.type === 'select' && this.multiple) {
            const selectElement = inputElement as HTMLSelectElement;
            newValue = Array.from(selectElement.selectedOptions).map(option => option.value);
        } else if (this.type === 'radio') {
            const checkedRadio = this.shadowRoot?.querySelector(`input[name="${this.name}"]:checked`) as HTMLInputElement;
            newValue = checkedRadio ? checkedRadio.value : null;
        } else if ((inputElement as HTMLInputElement).type === 'checkbox') {
            newValue = (inputElement as HTMLInputElement).checked;
        } else {
            newValue = inputElement.value;
        }
        
        // Update internal value first
        this._internalValue = this._parseValueForInternal(newValue);
        // Update public 'value' property (as string for attribute)
        this.value = (newValue === null || newValue === undefined) ? '' : String(newValue);
        this.EmitEvent('change', { id: this.id, name: this.name, value: this._internalValue, target: inputElement });
        // Validate after updating the value
        this.isValid();
    }

    private _handleSubmit(e: Event) {
        e.preventDefault();

        if (this.isValid()) {
            this.EmitEvent('form-submit', { id: this.id, name: this.name, value: this.getVal() });
        } else {
            const input = this._getInternalInputElement();
            input?.reportValidity();
        }
    }

    // Get internal input element
    private _getInternalInputElement(): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
        if (this.type === 'radio') return null;
        return this.shadowRoot?.querySelector('.input-element') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    }

    // Public methods
    /** Returns the current value (potentially typed) */
    getVal(): string | boolean | number | string[] | null {
        return this._internalValue;
    }

    /** Verifies input validity */
    isValid(): boolean {
        let valid = true;
        const inputElement = this._getInternalInputElement();

        if (inputElement) {
            valid = inputElement.checkValidity();
        } else if (this.type === 'radio' && this.required) {
            const checkedRadio = this.shadowRoot?.querySelector(`input[name="${this.name}"]:checked`);
            valid = checkedRadio !== null;
        }

        this._isValid = valid;
        return valid;
    }

    /** Sets the input value */
    setVal(val: string | boolean | number | string[] | null): void {
        this._internalValue = this._parseValueForInternal(val);
        this.value = (val === null || val === undefined) ? '' : String(val);
        this.requestUpdate();
        setTimeout(() => this.isValid(), 0);
    }

    /** Resets the input to its default value (empty or false) */
    reset(): void {
        let defaultVal: string | boolean | null = '';

        if (this.type === 'checkbox' || this.type === 'switch' || this.type === 'boolean') {
            defaultVal = false;
        } else if (this.type === 'radio') {
            const radioInputs = this.shadowRoot?.querySelectorAll(`input[name="${this.name}"]`);
            radioInputs?.forEach(r => (r as HTMLInputElement).checked = false);
            defaultVal = null;
        }

        this.setVal(defaultVal);
    }

    /** Sets options for select/radio inputs */
    setOpts(opts: Option[]): void {
        if (['select', 'radio'].includes(this.type)) {
            this.options = Array.isArray(opts) ? opts : [];
        }
    }

    /** Gets the selected option in a select */
    getSelOpt(): string | null {
        if (this.type === 'select') {
            const select = this._getInternalInputElement() as HTMLSelectElement;
            return select ? select.value : null;
        }
        return null;
    }
}

// Register the custom element
if (!customElements.get('c-input')) {
    customElements.define('c-input', CInput);
}