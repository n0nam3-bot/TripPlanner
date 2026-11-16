/**
 * Opens every collapsed <details> ancestor of a result before navigating to it.
 * The structural node shape keeps this helper easy to test without a browser DOM.
 */
export interface ResultNavigationNode {
  tagName: string;
  parentElement: ResultNavigationNode | null;
  open?: boolean;
}

/**
 * Expands collapsed details ancestors from the outermost section inward.
 * Returns the number of sections that were opened.
 */
export function expandCollapsedResultAncestors(target: Pick<ResultNavigationNode, "parentElement">): number {
  const ancestors: ResultNavigationNode[] = [];
  let current = target.parentElement;

  while (current) {
    if (current.tagName.toUpperCase() === "DETAILS") ancestors.push(current);
    current = current.parentElement;
  }

  let expandedCount = 0;
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const section = ancestors[index];
    if (section.open === false) {
      section.open = true;
      expandedCount += 1;
    }
  }

  return expandedCount;
}
