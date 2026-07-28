export { Preloader, type PreloaderProps } from "./preloader";
// `markIntroRevealed` is deliberately absent: the intro has exactly one
// publisher, and a barrel export invites a second one.
export { useIntroRevealed } from "./intro-state";
