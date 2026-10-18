import type { Transition, Variants } from "framer-motion";

/**
 * iOS 26 / visionOS-style spring presets.
 * Tuned for "liquid" UI: fast attack, gentle settle, optional micro-bounce.
 */
export const springs: Record<string, Transition> = {
  // Buttery smooth — panels, sheets, nav transitions
  soft: { type: "spring", stiffness: 320, damping: 32, mass: 0.9 },
  // Snappy — taps, toggles, hover lifts
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  // Bouncy — celebratory moments (upload done, unlock)
  bouncy: { type: "spring", stiffness: 420, damping: 18, mass: 0.8 },
  // Heavy fluid — modals, large glass surfaces
  fluid: { type: "spring", stiffness: 210, damping: 26, mass: 1.1 },
  // Lazy drift — ambient, non-interactive
  drift: { type: "spring", stiffness: 60, damping: 18, mass: 1.4 },
};

/** Staggered container for lists/grids of glass cards. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
};

/** Glass item: rise + fade with a soft spring. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springs.soft,
  },
};

/** Modal / sheet: scale + lift, heavy fluid settle. */
export const sheetEnter: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.94 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springs.fluid,
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.97,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
};

/** Backdrop fade for modals. */
export const fadeEnter: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.22 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

/** Shared press feedback — used via whileTap. */
export const pressScale = { scale: 0.97 };
export const pressScaleSubtle = { scale: 0.985 };

/** Layout animation config for the active-nav pill (shared layoutId). */
export const layoutSpring: Transition = springs.snappy;
