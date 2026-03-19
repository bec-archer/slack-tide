// Client-side image compression using Canvas API
// Zero external dependencies — runs entirely in the browser

export interface CompressionResult {
  blob: Blob
  width: number
  height: number
  originalSizeKB: number
  compressedSizeKB: number
}

/**
 * Compress and resize an image file before upload.
 * Uses Canvas API to resize to max dimension and export as JPEG.
 *
 * @param file - The image File from a file input
 * @param maxDimension - Max width or height in pixels (default 1200)
 * @param quality - JPEG quality 0-1 (default 0.8)
 * @returns Compressed blob with size metadata
 */
export function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.8
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'))
      return
    }

    const originalSizeKB = Math.round(file.size / 1024)

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension)
            width = maxDimension
          } else {
            width = Math.round((width / height) * maxDimension)
            height = maxDimension
          }
        }

        // Draw to canvas at new size
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Export as JPEG
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }

            resolve({
              blob,
              width,
              height,
              originalSizeKB,
              compressedSizeKB: Math.round(blob.size / 1024),
            })
          },
          'image/jpeg',
          quality
        )
      }

      img.src = reader.result as string
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Format bytes into a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
