import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ProtocolService } from '../../shared/services/protocol.service';
import { SampleService } from '../../shared/services/sample.service';
import { TestResultService } from '../../shared/services/test-result.service';
import { DeviationService } from '../../shared/services/deviation.service';
import { EnvironmentService } from '../../shared/services/environment.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TableModule, TagModule, ProgressBarModule],
  template: `
    <div class="space-y-6">
      <div class="card">
        <div class="page-header">
          <h2 class="page-title">欢迎回来，{{ auth.currentUser?.full_name }} 👋</h2>
          <p class="page-subtitle">以下是稳定性试验平台的运营概览和关键待办事项</p>
        </div>

        <div class="grid-4 mb-5">
          <div class="stat-card">
            <div class="flex justify-between items-start mb-3">
              <div>
                <div class="stat-label">试验方案</div>
                <div class="stat-value">{{ stats.protocolCount }}</div>
              </div>
              <div class="stat-icon" style="background: #dbeafe; color: #2563eb;"><i class="pi pi-file"></i></div>
            </div>
            <div class="flex gap-1 flex-wrap">
              <span class="badge badge-info">进行中 {{ stats.protocolInProgress }}</span>
              <span class="badge badge-success">已完成 {{ stats.protocolCompleted }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex justify-between items-start mb-3">
              <div>
                <div class="stat-label">样品总数</div>
                <div class="stat-value">{{ stats.sampleCount }}</div>
              </div>
              <div class="stat-icon" style="background: #dcfce7; color: #16a34a;"><i class="pi pi-box"></i></div>
            </div>
            <div class="flex gap-1 flex-wrap">
              <span class="badge badge-success">在储存 {{ stats.sampleInStorage }}</span>
              <span class="badge badge-danger" *ngIf="stats.sampleLocked > 0">🔒 锁定 {{ stats.sampleLocked }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex justify-between items-start mb-3">
              <div>
                <div class="stat-label">检测结果</div>
                <div class="stat-value">{{ stats.resultCount }}</div>
              </div>
              <div class="stat-icon" style="background: #fef3c7; color: #d97706;"><i class="pi pi-list-check"></i></div>
            </div>
            <div class="flex gap-1 flex-wrap">
              <span class="badge badge-info">待审批 {{ stats.resultPending }}</span>
              <span class="badge badge-success">已批准 {{ stats.resultApproved }}</span>
              <span class="badge badge-danger" *ngIf="stats.resultOOS > 0">OOS {{ stats.resultOOS }}</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="flex justify-between items-start mb-3">
              <div>
                <div class="stat-label">偏差调查</div>
                <div class="stat-value">{{ stats.deviationCount }}</div>
              </div>
              <div class="stat-icon" style="background: #fee2e2; color: #dc2626;"><i class="pi pi-exclamation-triangle"></i></div>
            </div>
            <div class="flex gap-1 flex-wrap">
              <span class="badge badge-warning">调查中 {{ stats.deviationOpen }}</span>
              <span class="badge badge-secondary">已关闭 {{ stats.deviationClosed }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card">
          <div class="flex justify-between items-center mb-4">
            <h3 class="section-title m-0 border-none">⏰ 即将到期待取样点</h3>
            <a routerLink="/samples" pButton label="前往取样" class="p-button-sm" icon="pi pi-arrow-right"></a>
          </div>

          @if (upcomingWindows().length === 0) {
            <div class="empty-state">
              <i class="pi pi-calendar"></i>
              <h3>暂无取样提醒</h3>
              <p>未来48小时内没有待执行的取样任务</p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (w of upcomingWindows(); track w.timepoint_id) {
                <div class="p-4 rounded-lg border transition"
                  [ngClass]="w.is_urgent ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <span class="font-semibold text-gray-800">{{ w.timepoint_label }}</span>
                      <p-tag [severity]="w.is_urgent ? 'danger' : 'info'" class="ml-2"
                        [value]="w.is_urgent ? '紧急' : w.is_within_window ? '窗口内' : '即将开放'">
                      </p-tag>
                    </div>
                    <span class="text-sm text-gray-500">
                      {{ w.is_within_window ? '距窗口结束' : '距窗口开放' }}
                      <b class="text-gray-800">{{ Math.max(0, w.days_until_window_start) }} 天</b>
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 space-y-1">
                    <div>📅 计划日期：<b>{{ w.planned_date }}</b></div>
                    <div>🔲 取样窗口：{{ w.window_start }} ~ {{ w.window_end }}</div>
                  </div>
                  <p-progressBar [value]="getProgress(w)" class="mt-2" [style]="{ height: '6px' }"
                    [ngClass]="w.is_urgent ? 'p-progressbar-danger' : 'p-progressbar-info'">
                  </p-progressBar>
                </div>
              }
            </div>
          }
        </div>

        <div class="card">
          <div class="flex justify-between items-center mb-4">
            <h3 class="section-title m-0 border-none">⚠️ 活跃环境警报 & 待处理偏差</h3>
            <div class="flex gap-2">
              <a routerLink="/environment/alerts" pButton label="警报列表" class="p-button-sm p-button-text" icon="pi pi-bell"></a>
              <a routerLink="/deviations" pButton label="偏差中心" class="p-button-sm" icon="pi pi-search"></a>
            </div>
          </div>

          <h4 class="text-sm font-semibold text-gray-700 mb-3">🚨 未确认环境警报：{{ unackAlerts().length }}</h4>
          @if (unackAlerts().length === 0) {
            <div class="p-3 bg-green-50 rounded-lg text-sm text-green-700 mb-4 flex items-center gap-2">
              <i class="pi pi-check-circle"></i>
              当前所有环境警报已确认
            </div>
          } @else {
            <div class="space-y-2 mb-5">
              @for (a of unackAlerts().slice(0, 5); track a.id) {
                <div class="p-3 rounded-lg flex items-center justify-between"
                  [ngClass]="a.alert_level === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'">
                  <div>
                    <div class="font-medium text-sm">
                      <span class="uppercase">{{ a.parameter_name }}</span> 偏差
                      <span [ngClass]="a.alert_level === 'critical' ? 'text-red-600' : 'text-yellow-700'">
                        · {{ a.alert_level === 'critical' ? '严重' : '警告' }}
                      </span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      {{ a.chamber_id }} · 实际值 <b>{{ a.actual_value }}</b> · 持续 {{ a.duration_minutes }}分钟
                    </div>
                  </div>
                  <i class="pi pi-exclamation-circle text-lg"
                    [ngClass]="a.alert_level === 'critical' ? 'text-red-500' : 'text-yellow-500'"></i>
                </div>
              }
            </div>
          }

          <h4 class="text-sm font-semibold text-gray-700 mb-3">🔍 待处理偏差：{{ openDeviations().length }}</h4>
          @if (openDeviations().length === 0) {
            <div class="p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <i class="pi pi-check-circle"></i>
              当前没有待处理的偏差调查
            </div>
          } @else {
            <div class="space-y-2">
              @for (d of openDeviations().slice(0, 5); track d.id) {
                <div class="p-3 rounded-lg border flex items-center justify-between"
                  [ngClass]="d.severity === 'critical' ? 'bg-red-50' : d.severity === 'major' ? 'bg-orange-50' : 'bg-gray-50'">
                  <div>
                    <div class="font-medium text-sm">{{ d.deviation_code }} · {{ d.title }}</div>
                    <div class="text-xs text-gray-500 mt-1">
                      {{ d.category }} · {{ d.severity === 'critical' ? '严重' : d.severity === 'major' ? '主要' : '次要' }}
                    </div>
                  </div>
                  <span class="badge"
                    [ngClass]="d.status === 'under_investigation' ? 'badge-warning' : 'badge-info'">
                    {{ d.status === 'under_investigation' ? '调查中' : '已报告' }}
                  </span>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <div class="card">
        <h3 class="section-title">📝 最近审批检测结果</h3>
        @if (recentResults().length === 0) {
          <div class="empty-state">
            <i class="pi pi-list-check"></i>
            <h3>暂无检测结果</h3>
            <p>完成检测后在此查看和审批结果</p>
          </div>
        } @else {
          <p-table [value]="recentResults()" [paginator]="false" responsiveLayout="scroll" size="small">
            <ng-template pTemplate="header">
              <tr>
                <th>结果编号</th>
                <th>样品ID</th>
                <th>分析员</th>
                <th>检测日期</th>
                <th>状态</th>
                <th>质量</th>
                <th>操作</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-r>
              <tr>
                <td><b>{{ r.result_code }}</b></td>
                <td>#{{ r.sample_id }}</td>
                <td>{{ r.analyst }}</td>
                <td>{{ r.testing_date }}</td>
                <td>
                  <p-tag [severity]="{draft:'secondary', submitted:'info', approved:'success', rejected:'danger'}[r.status]"
                    [value]="{draft:'草稿', submitted:'待审批', approved:'已批准', rejected:'已驳回', under_review:'审核中'}[r.status]">
                  </p-tag>
                </td>
                <td>
                  <span class="badge" [ngClass]="r.is_oos ? 'badge-danger' : r.is_oot ? 'badge-warning' : 'badge-success'">
                    {{ r.is_oos ? '❌ OOS' : r.is_oot ? '⚠️ OOT' : '✅ 合格' }}
                  </span>
                </td>
                <td>
                  <a [routerLink]="['/test-results', r.id]" pButton label="查看" class="p-button-text p-button-sm" icon="pi pi-eye"></a>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  Math = Math;

  stats: any = {
    protocolCount: 0, protocolInProgress: 0, protocolCompleted: 0,
    sampleCount: 0, sampleInStorage: 0, sampleLocked: 0,
    resultCount: 0, resultPending: 0, resultApproved: 0, resultOOS: 0,
    deviationCount: 0, deviationOpen: 0, deviationClosed: 0,
  };

  upcomingWindows = signal<any[]>([]);
  unackAlerts = signal<any[]>([]);
  openDeviations = signal<any[]>([]);
  recentResults = signal<any[]>([]);

  constructor(
    public auth: AuthService,
    private protocol: ProtocolService,
    private sample: SampleService,
    private result: TestResultService,
    private deviation: DeviationService,
    private env: EnvironmentService,
  ) {}

  ngOnInit(): void {
    this.protocol.list({ limit: 100 }).subscribe(list => {
      this.stats.protocolCount = list.length;
      this.stats.protocolInProgress = list.filter(p => p.status === 'in_progress' || p.status === 'approved').length;
      this.stats.protocolCompleted = list.filter(p => p.status === 'completed').length;
    });
    this.sample.list({ limit: 500 }).subscribe(list => {
      this.stats.sampleCount = list.length;
      this.stats.sampleInStorage = list.filter(s => s.status === 'in_storage').length;
      this.stats.sampleLocked = list.filter(s => s.is_locked).length;
    });
    this.result.list({ limit: 100 }).subscribe(list => {
      this.stats.resultCount = list.length;
      this.stats.resultPending = list.filter(r => r.status === 'submitted' || r.status === 'under_review').length;
      this.stats.resultApproved = list.filter(r => r.status === 'approved').length;
      this.stats.resultOOS = list.filter(r => r.is_oos).length;
      this.recentResults.set(list.slice(0, 10));
    });
    this.deviation.list({ limit: 100 }).subscribe(list => {
      this.stats.deviationCount = list.length;
      this.stats.deviationOpen = list.filter(d => !['closed', 'cancelled', 'completed'].includes(d.status)).length;
      this.stats.deviationClosed = list.filter(d => ['closed', 'completed'].includes(d.status)).length;
      this.openDeviations.set(list.filter(d => !['closed', 'cancelled', 'completed'].includes(d.status)).slice(0, 5));
    });
    this.protocol.getUpcomingSampling(72).subscribe(list => this.upcomingWindows.set(list));
    this.env.listAlerts({ acknowledged: false, limit: 10 }).subscribe(list => this.unackAlerts.set(list));
  }

  getProgress(w: any): number {
    if (w.is_within_window) return 50 + Math.random() * 30;
    if (w.days_until_window_start < 0) return 100;
    return Math.max(5, 50 - w.days_until_window_start * 10);
  }
}
