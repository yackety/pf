import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { PagedResult } from './devices.models';
import type {
    FileRecord,
    FileRecordFilterParams,
    InstallFileRequest,
    UpdateFileRecordRequest,
} from './files.models';

@Injectable({ providedIn: 'root' })
export class FilesService {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiBase}/files`;

  getAll(filter: FileRecordFilterParams = {}) {
    let params = new HttpParams();
    if (filter.fileType) params = params.set('fileType', filter.fileType);
    if (filter.search) params = params.set('search', filter.search);
    if (filter.page != null) params = params.set('page', String(filter.page));
    if (filter.pageSize != null) params = params.set('pageSize', String(filter.pageSize));
    return this.#http.get<PagedResult<FileRecord>>(this.#base, { params });
  }

  getOne(id: number) {
    return this.#http.get<FileRecord>(`${this.#base}/${id}`);
  }

  upload(file: File, meta: {
    agentId?: number;
    appName?: string;
    version?: string;
    packageName?: string;
    description?: string;
    requiresAndroid?: string;
    permissionsCount?: number;
    signature?: string;
    architectures?: string;
  }) {
    const fd = new FormData();
    fd.append('file', file);
    if (meta.agentId != null) fd.append('agentId', String(meta.agentId));
    if (meta.appName) fd.append('appName', meta.appName);
    if (meta.version) fd.append('version', meta.version);
    if (meta.packageName) fd.append('packageName', meta.packageName);
    if (meta.description) fd.append('description', meta.description);
    if (meta.requiresAndroid) fd.append('requiresAndroid', meta.requiresAndroid);
    if (meta.permissionsCount != null) fd.append('permissionsCount', String(meta.permissionsCount));
    if (meta.signature) fd.append('signature', meta.signature);
    if (meta.architectures) fd.append('architectures', meta.architectures);
    return this.#http.post<FileRecord>(this.#base, fd);
  }

  update(id: number, req: UpdateFileRecordRequest) {
    return this.#http.patch<FileRecord>(`${this.#base}/${id}`, req);
  }

  delete(id: number) {
    return this.#http.delete(`${this.#base}/${id}`);
  }

  install(id: number, req: InstallFileRequest) {
    return this.#http.post<unknown>(`${this.#base}/${id}/install`, req);
  }
}
