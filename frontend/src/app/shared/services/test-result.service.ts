import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TestResult, ResultStatus } from '../models';

const API_URL = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class TestResultService {
  constructor(private http: HttpClient) {}

  list(params?: {
    sample_id?: number; status?: ResultStatus;
    is_oos?: boolean; created_by?: number;
    skip?: number; limit?: number;
  }): Observable<TestResult[]> {
    let p = new HttpParams();
    if (params?.sample_id) p = p.set('sample_id', String(params.sample_id));
    if (params?.status) p = p.set('status', params.status);
    if (params?.is_oos !== undefined) p = p.set('is_oos', String(params.is_oos));
    if (params?.created_by) p = p.set('created_by', String(params.created_by));
    if (params?.skip) p = p.set('skip', String(params.skip));
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<TestResult[]>(`${API_URL}/test-results`, { params: p });
  }

  get(id: number): Observable<TestResult> {
    return this.http.get<TestResult>(`${API_URL}/test-results/${id}`);
  }

  create(data: any): Observable<TestResult> {
    return this.http.post<TestResult>(`${API_URL}/test-results`, data);
  }

  update(id: number, data: any): Observable<TestResult> {
    return this.http.put<TestResult>(`${API_URL}/test-results/${id}`, data);
  }

  submit(id: number, comments?: string): Observable<TestResult> {
    return this.http.post<TestResult>(`${API_URL}/test-results/${id}/submit`, { comments });
  }

  review(id: number, data: { approved: boolean; comments: string }): Observable<TestResult> {
    return this.http.post<TestResult>(`${API_URL}/test-results/${id}/review`, data);
  }

  canEdit(id: number): Observable<boolean> {
    return this.http.get<boolean>(`${API_URL}/test-results/${id}/can-edit`);
  }

  getApprovals(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/test-results/${id}/approvals`);
  }
}
