import { miniProgramApi } from './platform';

export interface RequiredSessionDestination {
  tab: boolean;
  url: string;
}

let pendingDestination: RequiredSessionDestination | null = null;

export function openRequiredSessionLogin(destination: RequiredSessionDestination): void {
  pendingDestination = destination;
  try {
    miniProgramApi().switchTab({ url: '/pages/account/index' });
  } catch {
    // The current page keeps its login gate when navigation is unavailable.
  }
}

export function resumeRequiredSessionDestination(): boolean {
  if (!pendingDestination) return false;

  const destination = pendingDestination;
  pendingDestination = null;
  const restorePendingDestination = () => {
    if (!pendingDestination) pendingDestination = destination;
  };

  try {
    if (destination.tab) {
      miniProgramApi().switchTab({
        fail: restorePendingDestination,
        url: destination.url,
      });
    } else {
      miniProgramApi().navigateTo({
        fail: restorePendingDestination,
        url: destination.url,
      });
    }
    return true;
  } catch {
    restorePendingDestination();
    return false;
  }
}
