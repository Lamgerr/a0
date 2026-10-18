import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps, type Transition } from "framer-motion";

export const EASE_APPLE: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const SPRING: Transition = { type: "spring", stiffness: 380, damping: 30 };
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 200, damping: 24 };

type BaseProps = HTMLMotionProps<"div">;

/** Fade + rise entrance. Respects reduced motion. */
export function FadeIn({ children, delay = 0, y = 8, ...props }: BaseProps & { delay?: number; y?: number }) {
  const rm = useReducedMotion();
  return (
    <motion.div
      initial={rm ? { opacity: 0 } : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={rm ? { duration: 0.15 } : { duration: 0.45, ease: EASE_APPLE, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers the entrance of its <StaggerItem> children. */
export function Stagger({ children, stagger = 0.04, delayChildren = 0, ...props }: BaseProps & { stagger?: number; delayChildren?: number }) {
  const rm = useReducedMotion();
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: rm ? 0 : stagger, delayChildren: rm ? 0 : delayChildren } } }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Child item for <Stagger>. Fades + rises into place. */
export function StaggerItem({ children, y = 10, ...props }: BaseProps & { y?: number }) {
  const rm = useReducedMotion();
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: rm ? 0 : y }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.4, ease: EASE_APPLE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Directional slide-in entrance. */
export function SlideIn({ children, from = "bottom", distance = 16, ...props }: BaseProps & { from?: "top" | "bottom" | "left" | "right"; distance?: number }) {
  const rm = useReducedMotion();
  const offset = rm ? 0 : distance;
  const dir =
    from === "top" ? { y: -offset } : from === "bottom" ? { y: offset } : from === "left" ? { x: -offset } : { x: offset };
  return (
    <motion.div
      initial={{ opacity: 0, ...dir }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.42, ease: EASE_APPLE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Subtle lift on hover. */
export function HoverLift({ children, lift = -3, ...props }: BaseProps & { lift?: number }) {
  const rm = useReducedMotion();
  return (
    <motion.div whileHover={rm ? undefined : { y: lift }} transition={{ duration: 0.2, ease: EASE_APPLE }} {...props}>
      {children}
    </motion.div>
  );
}

/** Springy press feedback (whileTap). */
export function PressScale({ children, scale = 0.97, ...props }: BaseProps & { scale?: number }) {
  const rm = useReducedMotion();
  return (
    <motion.div whileTap={rm ? undefined : { scale }} transition={{ duration: 0.12, ease: EASE_APPLE }} {...props}>
      {children}
    </motion.div>
  );
}

/** Reveal on scroll into view (once). */
export function Reveal({ children, y = 16, ...props }: BaseProps & { y?: number }) {
  const rm = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: rm ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: EASE_APPLE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Standard page transition wrapper (used by route changes). */
export function PageTransition({ children, ...props }: BaseProps) {
  const rm = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: rm ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE_APPLE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
