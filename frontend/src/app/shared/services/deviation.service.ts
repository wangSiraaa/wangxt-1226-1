import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Deviation, DeviationStatus, DeviationCategory, DeviationSeverity } from '../models';

const API_URL = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class DeviationService {
  constructor(private http: HttpClient) {}

  list(params?: {
    status?: DeviationStatus; category?: DeviationCategory; severity?: DeviationSeverity;
    protocol_id?: number; chamber_id?: string;
    reported_by?: number; handled_by?: number;
    skip?: number; limit?: number;
  }): Observable<Deviation[]> {
    let p = new HttpParams();
    if (params?.status) p = p.set('status', params.status);
    if (params?.category) p = p.set('category', params.category);
    if (params?.severity) p = p.set('severity', params.severity);
    if (params?.protocol_id) p = p.set('protocol_id', String(params.protocol_id));
    if (params?.chamber_id) p = p.set('chamber_id', params.chamber_id);
    if (params?.reported_by) p = p.set('reported_by', String(params.reported_by));
    if (params?.handled_by) p = p.set('handled_by', String(params.handled_by));
    if (params?.skip) p = p.set('skip', String(params.skip));
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<Deviation[]>(`${API_URL}/deviations`, { params: p });
  }

  get(id: number): Observable<Deviation> {
    return this.http.get<Deviation>(`${API_URL}/deviations/${id}`);
  }

  create(data: any): Observable<Deviation> {
    return this.http.post<Deviation>(`${API_URL}/deviations`, data);
  }

  update(id: number, data: any): Observable<Deviation> {
    return this.http.put<Deviation>(`${API_URL}/deviations/${id}`, data);
  }

  assign(id: number, data: { handled_by: number; remarks?: string }): Observable<Deviation> {
    return this.http.post<Deviation>(`${API_URL}/deviations/${id}/assign`, data);
  }

  updateStatus(id: number, data: { status: DeviationStatus; remarks?: string }): Observable<Deviation> {
    return this.http.patch<Deviation>(`${API_URL}/deviations/${id}/status`, data);
  }

  addAffectedSamples(id: number, data: {
    sample_ids: number[]; lock_samples?: boolean; impact_assessment?: string;
  }): Observable<Deviation> {
    return this.http.post<Deviation>(`${API_URL}/deviations/${id}/add-affected-samples`, data);
  }

  addConclusion(id: number, data: { conclusion_type: string; conclusion_text: string; attachments?: string }): Observable<any> {
    return this.http.post(`${API_URL}/deviations/${id}/conclusions`, data);
  }

  close(id: number, data: { final_conclusion: string; conclusion_date: string; effectiveness_check: string }): Observable<Deviation> {
    return this.http.post<Deviation>(`${API_URL}/deviations/${id}/close`, data);
  }

  unlockSamples(id: number): Observable<Deviation> {
    return this.http.post<Deviation>(`${API_URL}/deviations/${id}/unlock-samples`, {});
  }
}
