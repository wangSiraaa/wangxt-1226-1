import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Sample, SampleStatus, SamplingRecord } from '../models';

const API_URL = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class SampleService {
  constructor(private http: HttpClient) {}

  list(params?: {
    protocol_id?: number; condition_id?: number;
    status?: SampleStatus; is_locked?: boolean;
    skip?: number; limit?: number;
  }): Observable<Sample[]> {
    let p = new HttpParams();
    if (params?.protocol_id) p = p.set('protocol_id', String(params.protocol_id));
    if (params?.condition_id) p = p.set('condition_id', String(params.condition_id));
    if (params?.status) p = p.set('status', params.status);
    if (params?.is_locked !== undefined) p = p.set('is_locked', String(params.is_locked));
    if (params?.skip) p = p.set('skip', String(params.skip));
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<Sample[]>(`${API_URL}/samples`, { params: p });
  }

  get(id: number): Observable<Sample> {
    return this.http.get<Sample>(`${API_URL}/samples/${id}`);
  }

  generate(data: { protocol_id: number; samples_per_condition: number; code_prefix?: string }): Observable<any> {
    return this.http.post(`${API_URL}/samples/generate`, data);
  }

  create(data: Partial<Sample>): Observable<Sample> {
    return this.http.post<Sample>(`${API_URL}/samples`, data);
  }

  update(id: number, data: Partial<Sample>): Observable<Sample> {
    return this.http.put<Sample>(`${API_URL}/samples/${id}`, data);
  }

  putInChamber(data: {
    sample_ids: number[]; location: string; chamber_position?: string;
    temperature?: string; humidity?: string; remarks?: string;
  }): Observable<any> {
    return this.http.post(`${API_URL}/samples/in-chamber`, data);
  }

  takeOutChamber(data: {
    sample_ids: number[]; reason: string;
    temperature?: string; humidity?: string; remarks?: string;
  }): Observable<any> {
    return this.http.post(`${API_URL}/samples/out-chamber`, data);
  }

  checkSamplingWindow(sampleId: number, timepointId: number): Observable<any> {
    return this.http.get(`${API_URL}/samples/${sampleId}/check-sampling-window/${timepointId}`);
  }

  createSamplingRecord(data: {
    sample_id: number; timepoint_id: number;
    sampled_at: string; sampled_quantity: number;
    out_chamber_time: string; return_chamber_time?: string;
    total_exposure_minutes?: number; remarks?: string;
  }): Observable<any> {
    return this.http.post(`${API_URL}/samples/sampling-records`, data);
  }

  getSamplingRecordsBySample(sampleId: number): Observable<SamplingRecord[]> {
    return this.http.get<SamplingRecord[]>(`${API_URL}/samples/${sampleId}/sampling-records`);
  }

  lock(id: number, data: { lock_reason: string; related_deviation_id?: number }): Observable<Sample> {
    return this.http.post<Sample>(`${API_URL}/samples/${id}/lock`, data);
  }

  unlock(id: number, data: { unlock_reason: string }): Observable<Sample> {
    return this.http.post<Sample>(`${API_URL}/samples/${id}/unlock`, data);
  }
}
