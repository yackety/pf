export interface FileRecord {
  id: number;
  agentId: number | null;
  storedName: string;
  originalName: string;
  fileType: string; // apk | images | videos | other
  subFolder: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number;
  appName: string | null;
  version: string | null;
  packageName: string | null;
  description: string | null;
  requiresAndroid: string | null;
  permissionsCount: number | null;
  signature: string | null;
  architectures: string | null;
  uploadedAt: string;
  uploadedByUsername: string | null;
}

export interface FileRecordFilterParams {
  fileType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateFileRecordRequest {
  appName?: string | null;
  version?: string | null;
  packageName?: string | null;
  description?: string | null;
  requiresAndroid?: string | null;
  permissionsCount?: number | null;
  signature?: string | null;
  architectures?: string | null;
}

export interface InstallFileRequest {
  udids: string[];
}
