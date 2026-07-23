export class DomLocalizationController {
  constructor() {
    this.language = 'en';
    this.dictionary = {};
    this.textSources = new WeakMap();
    this.attributeSources = new WeakMap();
    this.observer = null;
    this.attributes = ['aria-label', 'content', 'placeholder', 'title'];
  }

  start() {
    if (this.observer || !document.documentElement) return;
    this.observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'characterData') this.localizeText(record.target);
        record.addedNodes.forEach((node) => this.localize(node));
      });
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    this.localize(document.documentElement);
  }

  setLanguage(language, translations) {
    this.language = language;
    this.dictionary = language === 'en' ? translations.legacy || {} : {};
    if (document.documentElement) this.localize(document.documentElement);
  }

  localize(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      this.localizeText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) this.localizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) this.localizeText(node);
      else this.localizeElement(node);
      node = walker.nextNode();
    }
  }

  localizeText(node) {
    const parent = node.parentElement;
    if (!parent || this.excluded(parent)) return;
    if (!this.textSources.has(node)) this.textSources.set(node, node.nodeValue);
    const source = this.textSources.get(node);
    const value = this.render(source);
    if (node.nodeValue !== value) node.nodeValue = value;
  }

  localizeElement(element) {
    if (this.excluded(element)) return;
    let sources = this.attributeSources.get(element);
    if (!sources) {
      sources = {};
      this.attributes.forEach((attribute) => {
        if (element.hasAttribute(attribute)) sources[attribute] = element.getAttribute(attribute);
      });
      this.attributeSources.set(element, sources);
    }
    Object.entries(sources).forEach(([attribute, source]) => {
      const value = this.translate(source);
      if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    });
  }

  render(source) {
    const match = String(source).match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return source;
    const normalized = match[2].replaceAll(/\s+/g, ' ').trim();
    const translated = this.dictionary[normalized];
    return translated === undefined ? source : `${match[1]}${translated}${match[3]}`;
  }

  translate(source) {
    const normalized = String(source).replaceAll(/\s+/g, ' ').trim();
    return this.dictionary[normalized] ?? source;
  }

  excluded(element) {
    return (
      ['SCRIPT', 'STYLE'].includes(element.tagName) ||
      element.classList.contains('material-icons-round') ||
      Boolean(element.closest('[x-text], [x-html]'))
    );
  }
}
