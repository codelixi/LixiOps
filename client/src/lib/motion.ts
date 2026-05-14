export const easeOutExpo = [0.16, 1, 0.3, 1] as const

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: easeOutExpo },
}

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.3, ease: easeOutExpo },
}

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.25, ease: easeOutExpo },
}

export const slideInLeft = {
  initial: { opacity: 0, x: -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.3, ease: easeOutExpo },
}

export const slideInRight = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
  transition: { duration: 0.3, ease: easeOutExpo },
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: easeOutExpo } },
}

export const microBounce = {
  whileTap: { scale: 0.97 },
  transition: { type: 'spring' as const, stiffness: 400, damping: 17 },
}

export const hoverLift = {
  whileHover: { y: -2, boxShadow: '0 8px 25px -5px rgba(0,0,0,0.08)' },
  transition: { duration: 0.2, ease: easeOutExpo },
}
