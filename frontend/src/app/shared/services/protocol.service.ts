import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Protocol, ProtocolCreate, ProtocolUpdate, ProtocolStatus, SamplingWindowInfo, SamplingTimepointUpdate } from '../models';

const API_URL = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class ProtocolService {
  constructor(private http: HttpClient) {}

  list(params?: { status?: ProtocolStatus; created_by?: number; skip?: number; limit?: number }): Observable<Protocol[]> {
    let p = new HttpParams();
    if (params?.status) p = p.set('status', params.status);
    if (params?.created_by) p = p.set('created_by', String(params.created_by));
    if (params?.skip) p = p.set('skip', String(params.skip));
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<Protocol[]>(`${API_URL}/protocols`, { params: p });
  }

  get(id: number): Observable<Protocol> {
    return this.http.get<Protocol>(`${API_URL}/protocols/${id}`);
  }

  create(data: ProtocolCreate): Observable<Protocol> {
    return this.http.post<Protocol>(`${API_URL}/protocols`, data);
  }

  update(id: number, data: ProtocolUpdate): Observable<Protocol> {
    return this.http.put<Protocol>(`${API_URL}/protocols/${id}`, data);
  }

  updateStatus(id: number, status: ProtocolStatus, remarks?: string): Observable<Protocol> {
    return this.http.patch<Protocol>(`${API_URL}/protocols/${id}/status`, { status, remarks });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/protocols/${id}`);
  }

  getUpcomingSampling(hoursAhead: number = 48): Observable<SamplingWindowInfo[]> {
    return this.http.get<SamplingWindowInfo[]>(`${API_URL}/protocols/upcoming-sampling`, {
      params: { hours_ahead: String(hoursAhead) }
    });
  }

  getTimepoints(protocolId: number): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/protocols/${protocolId}/timepoints`);
  }

  updateTimepoint(protocolId: number, tpId: number, data: SamplingTimepointUpdate): Observable<any> {
    return this.http.patch<any>(`${API_URL}/protocols/${protocolId}/timepoints/${tpId}`, data);
  }

  getTimepointWindow(protocolId: number, tpId: number): Observable<SamplingWindowInfo> {
    return this.http.get<SamplingWindowInfo>(`${API_URL}/protocols/${protocolId}/timepoints/${tpId}/window-info`);
  }

  getStorageConditions(protocolId: number): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/protocols/${protocolId}/storage-conditions`);
  }
}

export interface ProtocolCreate {
  title: string;
  product_name: string;
  batch_number: string;
  specification?: string;
  manufacturer?: string;
  package_type?: string;
  study_type: string;
  start_date: string;
  expected_end_date: string;
  total_duration_months: number;
  purpose?: string;
  testing_scope?: string;
  reference_standards?: string;
  storage_conditions: Array<{
    condition_code: string; condition_name: string;
    temperature_min: number; temperature_max: number; temperature_target: number;
    humidity_min?: number; humidity_max?: number; humidity_target?: number;
    light_condition?: string; location: string; chamber_id?: string;
  }>;
  sampling_timepoints: Array<{
    timepoint_month: number; timepoint_label: string; planned_date: string;
    window_before_days?: number; window_after_days?: number; sample_count_per_condition?: number;
  }>;
}

export interface ProtocolUpdate {
  title?: string; specification?: string; manufacturer?: string;
  package_type?: string; expected_end_date?: string;
  purpose?: string; testing_scope?: string; reference_standards?: string;
  status?: ProtocolStatus;
}

export interface SamplingTimepointUpdate {
  window_before_days?: number; window_after_days?: number; sample_count_per_condition?: number;
}
