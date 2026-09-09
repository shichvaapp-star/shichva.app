export interface UploadResult {
  url: string;
  publicId: string;
  format?: string;
  resourceType?: string;
}

/**
 * Uploads a file to Cloudinary via our secure server route `/api/upload`.
 * Uses XMLHttpRequest to provide real-time progress callback.
 */
export function uploadFileToCloudinary(
  file: File,
  folder: string = "shichva",
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.url && res.publicId) {
            resolve({
              url: res.url,
              publicId: res.publicId,
              format: res.format,
              resourceType: res.resourceType,
            });
          } else {
            reject(new Error(res.error || "Upload failed: missing url or publicId"));
          }
        } catch {
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during file upload"));
    };

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

/**
 * Deletes a file from Cloudinary via `/api/delete-upload`.
 */
export async function deleteUploadedFile(
  publicId: string,
  resourceType: "image" | "raw" | "auto" = "image"
): Promise<boolean> {
  try {
    const res = await fetch("/api/delete-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId, resourceType }),
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.warn("Failed to delete file from Cloudinary:", err);
    return false;
  }
}
