export class ModalScrollLock {
  constructor() {
    this.entries = [];
    this.active = false;
  }

  lock() {
    if (this.active) return;
    this.active = true;
    this.entries = this.documents().map((document) => this.lockDocument(document));
  }

  unlock() {
    if (!this.active) return;
    for (const entry of this.entries) this.restore(entry);
    this.entries = [];
    this.active = false;
  }

  documents() {
    const documents = [document];
    try {
      if (window.parent !== window && window.parent.document !== document) {
        documents.push(window.parent.document);
      }
    } catch {
      // Parent documents may be cross-origin or unavailable.
    }
    return documents;
  }

  lockDocument(document) {
    const root = document.documentElement;
    const body = document.body;
    const view = document.defaultView;
    const entry = {
      root,
      body,
      view,
      scrollX: view?.scrollX || 0,
      scrollY: view?.scrollY || 0,
      rootOverflow: root.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
      bodyOverflow: body?.style.overflow || '',
      bodyOverscroll: body?.style.overscrollBehavior || '',
      bodyPosition: body?.style.position || '',
      bodyTop: body?.style.top || '',
      bodyLeft: body?.style.left || '',
      bodyRight: body?.style.right || '',
      bodyWidth: body?.style.width || '',
    };
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    if (body) {
      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      body.style.position = 'fixed';
      body.style.top = `-${entry.scrollY}px`;
      body.style.left = `-${entry.scrollX}px`;
      body.style.right = '0';
      body.style.width = '100%';
    }
    return entry;
  }

  restore(entry) {
    entry.root.style.overflow = entry.rootOverflow;
    entry.root.style.overscrollBehavior = entry.rootOverscroll;
    if (entry.body) {
      entry.body.style.overflow = entry.bodyOverflow;
      entry.body.style.overscrollBehavior = entry.bodyOverscroll;
      entry.body.style.position = entry.bodyPosition;
      entry.body.style.top = entry.bodyTop;
      entry.body.style.left = entry.bodyLeft;
      entry.body.style.right = entry.bodyRight;
      entry.body.style.width = entry.bodyWidth;
    }
    entry.view?.scrollTo(entry.scrollX, entry.scrollY);
  }
}
