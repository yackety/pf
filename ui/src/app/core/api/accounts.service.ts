import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type {
  Account,
  AccountFilterParams,
  CreateAccountRequest,
  Platform,
  UpdateAccountRequest,
} from './accounts.models';
import type { PagedResult } from './devices.models';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  readonly #http = inject(HttpClient);
  readonly #base = `${environment.apiBase}/accounts`;

  getAll(filter: AccountFilterParams = {}) {
    let params = new HttpParams();
    if (filter.platformId != null) params = params.set('platformId', String(filter.platformId));
    if (filter.status) params = params.set('status', filter.status);
    if (filter.search) params = params.set('search', filter.search);
    if (filter.page != null) params = params.set('page', String(filter.page));
    if (filter.pageSize != null) params = params.set('pageSize', String(filter.pageSize));
    return this.#http.get<PagedResult<Account>>(this.#base, { params });
  }

  getOne(id: number) {
    return this.#http.get<Account>(`${this.#base}/${id}`);
  }

  create(req: CreateAccountRequest) {
    return this.#http.post<Account>(this.#base, req);
  }

  update(id: number, req: UpdateAccountRequest) {
    return this.#http.put<Account>(`${this.#base}/${id}`, req);
  }

  delete(id: number) {
    return this.#http.delete<void>(`${this.#base}/${id}`);
  }

  getPlatforms() {
    return this.#http.get<Platform[]>(`${environment.apiBase}/platforms`);
  }
}
