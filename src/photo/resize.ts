/** Edge length of stored photos, in pixels: sharp on a 2x screen at the biggest size shown. */
const SIZE = 320

/**
 * A square JPEG of the image, cropped around the upper middle where faces usually are.
 * Throws when the browser can't read the file (e.g. an unsupported format).
 */
export async function resizePhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) * 0.3
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}
