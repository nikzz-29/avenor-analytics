'use client';
import { useEffect } from 'react';

export const WORKSPACE_NAVIGATION_EVENT = 'avenor:before-workspace-change';
export function canLeaveWorkspace() {
  return window.dispatchEvent(new Event(WORKSPACE_NAVIGATION_EVENT, { cancelable: true }));
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const confirm = () =>
      window.confirm('You have unsaved dashboard changes. Leave without saving?');
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const changeWorkspace = (event: Event) => {
      if (!confirm()) event.preventDefault();
    };
    const followLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return;
      const next = new URL(anchor.href, location.href);
      if (
        next.origin !== location.origin ||
        next.pathname + next.search === location.pathname + location.search
      )
        return;
      if (!confirm()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener(WORKSPACE_NAVIGATION_EVENT, changeWorkspace);
    document.addEventListener('click', followLink, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener(WORKSPACE_NAVIGATION_EVENT, changeWorkspace);
      document.removeEventListener('click', followLink, true);
    };
  }, [dirty]);
}
