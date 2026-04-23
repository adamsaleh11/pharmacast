type ChatSidebarSlotListener = () => void;

let chatSidebarSlot: HTMLElement | null = null;
const listeners = new Set<ChatSidebarSlotListener>();

export function setChatSidebarSlot(node: HTMLElement | null) {
  if (chatSidebarSlot === node) {
    return;
  }

  chatSidebarSlot = node;
  listeners.forEach((listener) => listener());
}

export function getChatSidebarSlot() {
  return chatSidebarSlot;
}

export function subscribeChatSidebarSlot(listener: ChatSidebarSlotListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
