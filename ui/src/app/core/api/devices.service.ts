import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type {
  Device,
  DeviceAccount,
  DeviceActionRequest,
  DeviceFilterParams,
  DeviceMeta,
  DeviceSessionLog,
  PagedResult,
} from './devices.models';

@Injectable({ providedIn: 'root' })
export class DevicesService {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiBase}/devices`;

  getAll(filter: DeviceFilterParams = {}) {
    let params = new HttpParams();
    if (filter.state) params = params.set('state', filter.state);
    if (filter.platform) params = params.set('platform', filter.platform);
    if (filter.agentId != null) params = params.set('agentId', String(filter.agentId));
    if (filter.tag) params = params.set('tag', filter.tag);
    if (filter.search) params = params.set('search', filter.search);
    if (filter.page != null) params = params.set('page', String(filter.page));
    if (filter.pageSize != null) params = params.set('pageSize', String(filter.pageSize));
    return this.#http.get<PagedResult<Device>>(this.#base, { params });
  }

  getOne(udid: string) {
    return this.#http.get<Device>(`${this.#base}/${udid}`);
  }

  updateMeta(udid: string, meta: DeviceMeta) {
    return this.#http.patch<Device>(`${this.#base}/${udid}`, meta);
  }

  getSessionLog(udid: string, page = 1, pageSize = 50) {
    const params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    return this.#http.get<PagedResult<DeviceSessionLog>>(`${this.#base}/${udid}/log`, { params });
  }

  getAccounts(udid: string) {
    return this.#http.get<DeviceAccount[]>(`${this.#base}/${udid}/accounts`);
  }

  linkAccount(udid: string, accountId: number) {
    return this.#http.post<void>(`${this.#base}/${udid}/accounts/${accountId}`, {});
  }

  unlinkAccount(udid: string, accountId: number) {
    return this.#http.delete<void>(`${this.#base}/${udid}/accounts/${accountId}`);
  }

  sendAction(udid: string, action: DeviceActionRequest) {
    return this.#http.post<unknown>(`${this.#base}/${udid}/action`, action);
  }
}
