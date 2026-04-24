/**
 * Image Provider Registry
 */

import { ProviderRegistry } from '../core/provider-registry.js'
import type { ImageProvider, ImageProviderConfig, ImageProviderFactory } from './image-provider.js'

export const imageRegistry = new ProviderRegistry<ImageProvider>()

export function registerImageProvider(name: string, factory: ImageProviderFactory): void {
  imageRegistry.register(name, factory)
}

export function createImageProvider(config: ImageProviderConfig): ImageProvider {
  return imageRegistry.create(config)
}

export function listImageProviders(): string[] {
  return imageRegistry.listProviders()
}

export function hasImageProvider(name: string): boolean {
  return imageRegistry.hasProvider(name)
}

export { imageRegistry as registry }
