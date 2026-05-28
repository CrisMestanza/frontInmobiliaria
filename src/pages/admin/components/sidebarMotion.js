export const SIDEBAR_SPRING = {
  type: 'spring',
  stiffness: 280,
  damping: 30,
  mass: 0.82,
  restDelta: 0.4,
  restSpeed: 0.4,
};

export const SIDEBAR_ITEM_HOVER = {
  x: 0,
  transition: {
    duration: 0.18,
    ease: [0.22, 1, 0.36, 1],
  },
};

export const SIDEBAR_SUBMENU_VARIANTS = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.14, ease: 'easeOut' },
    },
  },
  open: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
      opacity: { duration: 0.18, ease: 'easeOut', delay: 0.02 },
    },
  },
};

export const SIDEBAR_SUBMENU_ITEM_VARIANTS = {
  collapsed: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.12, ease: 'easeInOut' },
  },
  open: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
      delay: index * 0.022,
    },
  }),
};
