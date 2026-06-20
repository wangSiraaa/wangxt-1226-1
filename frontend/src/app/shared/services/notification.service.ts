import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notification } from '../models';

const API_URL = 'http://localhost:8000/api';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private http: HttpClient) {}

  list(params?: { is_read?: boolean; limit?: number; skip?: number }): Observable<Notification[]> {
    let q: any = {};
    if (params?.is_read !== undefined) q.is_read = params.is_read;
    if (params?.limit) q.limit = params.limit;
    if (params?.skip) q.skip = params.skip;
    return this.http.get<Notification[]>(`${API_URL}/notifications`, { params: q });
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<number>(`${API_URL}/notifications/unread-count`);
  }

  markRead(id: number): Observable<Notification> {
    return this.http.patch<Notification>(`${API_URL}/notifications/${id}/read`, {});
  }

  markAllRead(): Observable<number> {
    return this.http.patch<number>(`${API_URL}/notifications/read-all`, {});
  }
}
