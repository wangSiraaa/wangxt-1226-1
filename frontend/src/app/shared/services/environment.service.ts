import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EnvironmentRecord, EnvironmentAlert, AlertLevel } from '../models';

const API_URL = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  constructor(private http: HttpClient) {}

  listRecords(params?: {
    chamber_id?: string; condition_id?: number;
    start_date?: string; end_date?: string;
    has_deviation_only?: boolean; skip?: number; limit?: number;
  }): Observable<EnvironmentRecord[]> {
    let p = new HttpParams();
    if (params?.chamber_id) p = p.set('chamber_id', params.chamber_id);
    if (params?.condition_id) p = p.set('condition_id', String(params.condition_id));
    if (params?.start_date) p = p.set('start_date', params.start_date);
    if (params?.end_date) p = p.set('end_date', params.end_date);
    if (params?.has_deviation_only) p = p.set('has_deviation_only', String(params.has_deviation_only));
    if (params?.skip) p = p.set('skip', String(params.skip));
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<EnvironmentRecord[]>(`${API_URL}/environment/records`, { params: p });
  }

  createRecord(data: Partial<EnvironmentRecord>): Observable<any> {
    return this.http.post(`${API_URL}/environment/records`, data);
  }

  getRecord(id: number): Observable<EnvironmentRecord> {
    return this.http.get<EnvironmentRecord>(`${API_URL}/environment/records/${id}`);
  }

  listAlerts(params?: {
    chamber_id?: string; acknowledged?: boolean; level?: AlertLevel;
    start_date?: string; end_date?: string; skip?: number; limit?: number;
  }): Observable<EnvironmentAlert[]> {
    let p = new HttpParams();
    if (params?.chamber_id) p = p.set('chamber_id', params.chamber_id);
    if (params?.acknowledged !== undefined) p = p.set('acknowledged', String(params.acknowledged));
    if (params?.level) p = p.set('level', params.level);
    if (params?.start_date) p = p.set('start_date', params.start_date);
    if (params?.end_date) p = p.set('end_date', params.end_date);
    if (params?.skip) p = p.set('skip', String(params.skip));
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<EnvironmentAlert[]>(`${API_URL}/environment/alerts`, { params: p });
  }

  getAlert(id: number): Observable<EnvironmentAlert> {
    return this.http.get<EnvironmentAlert>(`${API_URL}/environment/alerts/${id}`);
  }

  acknowledgeAlert(id: number, data: { acknowledge_remark: string; create_deviation: boolean }): Observable<any> {
    return this.http.post(`${API_URL}/environment/alerts/${id}/acknowledge`, data);
  }

  getDailyStats(chamberId: string, date: string): Observable<any> {
    return this.http.get(`${API_URL}/environment/daily-stats/${chamberId}`, {
      params: { stats_date: date }
    });
  }
}
