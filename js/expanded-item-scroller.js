export class ExpandedItemScroller {
  constructor({ padding = 16, headerSelector = '.topbar' } = {}) {
    this.padding = padding;
    this.headerSelector = headerSelector;
  }

  reveal(trigger, groupName) {
    const anchor = trigger?.closest('tr');
    const table = anchor?.closest('table');
    if (!anchor || !table) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.scroll(table, anchor, groupName));
    });
  }

  scroll(table, anchor, groupName) {
    const rows = Array.from(table.querySelectorAll('tbody tr')).filter(
      (row) => row.dataset.groupName === groupName && row.getClientRects().length > 0
    );
    if (rows.length === 0) return;

    const firstRect = anchor.getBoundingClientRect();
    const lastRect = rows.at(-1).getBoundingClientRect();
    const headerBottom =
      document.querySelector(this.headerSelector)?.getBoundingClientRect().bottom ?? 0;
    const viewportTop = headerBottom + this.padding;
    const viewportBottom = window.innerHeight - this.padding;
    const groupHeight = lastRect.bottom - firstRect.top;
    const viewportHeight = viewportBottom - viewportTop;
    let offset = 0;

    if (groupHeight > viewportHeight || firstRect.top < viewportTop) {
      offset = firstRect.top - viewportTop;
    } else if (lastRect.bottom > viewportBottom) {
      offset = lastRect.bottom - viewportBottom;
    }

    if (Math.abs(offset) < 1) return;

    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    window.scrollBy({ top: offset, behavior });
  }
}
