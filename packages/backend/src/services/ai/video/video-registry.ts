/**
 * Video Provider Registry
 */

import { ProviderRegistry } from '../core/provider-registry.js'
import type { VideoProvider, ProviderConfig } from './video-provider.js'

export const videoRegistry = new ProviderRegistry<VideoProvider>()

export function registerVideoProvider(
  name: string,
  factory: (config: ProviderConfig) => VideoProvider
): void {
  videoRegistry.register(name, factory)
}

export function createVideoProvider(config: ProviderConfig): VideoProvider {
  return videoRegistry.create(config)
}

export function listVideoProviders(): string[] {
  return videoRegistry.listProviders()
}

export function hasVideoProvider(name: string): boolean {
  return videoRegistry.hasProvider(name)
}
