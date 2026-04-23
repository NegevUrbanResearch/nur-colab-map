/**
 * The folder name under `src/assets/layers/<folderId>` should match `manifest.id`
 * so URLs and dev tooling stay predictable.
 */
export function packFolderIdMatchesManifestId(
  packFolderId: string,
  manifestId: string,
): boolean {
  return packFolderId === manifestId;
}

/**
 * In development (not in Vitest), logs a clear warning if folder id ≠ manifest id.
 * Does not throw; use {@link packFolderIdMatchesManifestId} in tests.
 */
export function warnIfPackFolderIdMismatchesManifest(
  packFolderId: string,
  manifest: { id: string },
  context: string = "buildLayerRegistry",
): void {
  if (packFolderIdMatchesManifestId(packFolderId, manifest.id)) return;
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
    console.warn(
      `[layerRegistry] Pack folder id "${packFolderId}" does not match manifest id "${manifest.id}" (${context}). Rename the folder or set manifest "id" to match.`,
    );
  }
}
