/**
 * Storyboard generation module
 * Exports all storyboard-related utilities from a single entry point.
 */

// Core orchestrator
export { generateStoryboard } from '../storyboard-generator.js'
export type { StoryboardGeneratorOptions } from '../storyboard-generator.js'

// Pure function utilities
export {
  determineVisualStyle,
  determineCameraMovement,
  determineSpecialEffects
} from './style-detectors.js'
export { inferVoiceConfig } from './voice-config-inferrer.js'
export { generateSeedancePrompt } from './prompt-builder.js'
export { buildVoiceSegments } from './voice-builder.js'
export { exportStoryboardAsText, exportStoryboardAsJSON } from './exporters.js'
