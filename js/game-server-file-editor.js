export class GameServerFileEditor {
  constructor(view, onDirtyChange) {
    this.view = view;
    this.onDirtyChange = onDirtyChange;
    this.baseline = '';
    this.fileName = '';
    this.dirty = false;
    this.view.editor.addEventListener('input', () => this.input());
    this.view.editor.addEventListener('scroll', () => {
      this.view.lines.scrollTop = this.view.editor.scrollTop;
    });
    this.view.editor.addEventListener('keydown', (event) => this.keydown(event));
  }

  load(file) {
    this.fileName = file.name;
    this.baseline = file.content;
    this.view.editor.value = file.content;
    this.view.editor.disabled = !file.writable;
    this.setDirty(false);
    this.renderLines();
    this.validate();
  }

  reset(message) {
    this.fileName = '';
    this.baseline = '';
    this.view.editor.value = '';
    this.view.editor.disabled = true;
    this.view.lines.textContent = '1';
    this.view.validation.textContent = message;
    this.view.validation.className = 'fm-validation';
    this.setDirty(false);
  }

  markSaved(content) {
    this.baseline = content;
    this.setDirty(false);
    this.validate();
  }

  content() {
    return this.view.editor.value;
  }

  isDirty() {
    return this.dirty;
  }

  findNext(query) {
    if (!query) return false;
    const content = this.content().toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    const start = this.view.editor.selectionEnd;
    let index = content.indexOf(needle, start);
    if (index < 0) index = content.indexOf(needle);
    if (index < 0) return false;
    this.view.editor.focus();
    this.view.editor.setSelectionRange(index, index + query.length);
    return true;
  }

  replace(query, replacement) {
    if (!query || this.view.editor.disabled) return false;
    const start = this.view.editor.selectionStart;
    const end = this.view.editor.selectionEnd;
    if (this.content().slice(start, end).toLocaleLowerCase() !== query.toLocaleLowerCase()) {
      return this.findNext(query);
    }
    this.view.editor.setRangeText(replacement, start, end, 'end');
    this.input();
    return true;
  }

  input() {
    this.setDirty(this.content() !== this.baseline);
    this.renderLines();
    this.validate();
  }

  keydown(event) {
    if (event.key !== 'Tab' || this.view.editor.disabled) return;
    event.preventDefault();
    const start = this.view.editor.selectionStart;
    const end = this.view.editor.selectionEnd;
    this.view.editor.setRangeText('  ', start, end, 'end');
    this.input();
  }

  setDirty(dirty) {
    if (this.dirty === dirty) return;
    this.dirty = dirty;
    this.onDirtyChange(dirty);
  }

  renderLines() {
    const count = this.content().split('\n').length;
    this.view.lines.textContent = Array.from({ length: count }, (_, index) => index + 1).join('\n');
  }

  validate() {
    const extension = this.fileName.split('.').pop()?.toLocaleLowerCase();
    if (extension !== 'json') {
      this.view.validation.textContent = this.fileName ? extension?.toUpperCase() || 'TEXT' : '';
      this.view.validation.className = 'fm-validation';
      return;
    }
    try {
      JSON.parse(this.content());
      this.view.validation.textContent = 'Valid JSON';
      this.view.validation.className = 'fm-validation valid';
    } catch (error) {
      this.view.validation.textContent = error instanceof Error ? error.message : 'Invalid JSON';
      this.view.validation.className = 'fm-validation invalid';
    }
  }
}
