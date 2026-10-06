// Attachments go up with a reply or note as base64 in the request body (the API has no multipart upload). The limits
// come from `GET /settings/attachments`; osTicket's own refusal ("File size is too large") still arrives as the
// command's error, so these checks only spare a round trip.

export interface AttachmentLimits {
  max_file_bytes: number;
  max_files: number;
  max_total_bytes: number;
}

export interface UploadedFile {
  name: string;
  content_type?: string;
  data: string;
}

const mb = (bytes: number) => `${Math.round((bytes / 1048576) * 10) / 10} MB`;

/** The first reason these files cannot be sent, or null. */
export function attachmentProblem(files: Pick<File, "name" | "size">[], limits: AttachmentLimits | undefined): string | null {
  if (!limits) return null;
  if (files.length > limits.max_files) return `At most ${limits.max_files} files can be attached.`;
  const tooBig = files.find((f) => f.size > limits.max_file_bytes);
  if (tooBig) return `${tooBig.name} is larger than the ${mb(limits.max_file_bytes)} limit for one file.`;
  if (files.reduce((sum, f) => sum + f.size, 0) > limits.max_total_bytes) return `The files together are larger than the ${mb(limits.max_total_bytes)} limit.`;
  return null;
}

/** A file's bytes as base64 with no `data:` prefix. */
export async function encodeFile(file: File): Promise<UploadedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return { name: file.name, ...(file.type ? { content_type: file.type } : {}), data: btoa(binary) };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 102.4) / 10} KB`;
  return mb(bytes);
}
