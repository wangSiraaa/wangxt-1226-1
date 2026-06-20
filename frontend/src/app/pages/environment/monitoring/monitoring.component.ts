import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { EnvironmentService } from '../../../shared/services/environment.service';
import { AuthService } from '../../../shared/services/auth.service';
import { AlertLevel } from '../../../shared/models';

@Component({
  selector: 'app-environment-monitoring',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, TableModule, TagModule,
    DropdownModule, CalendarModule, InputTextModule, DialogModule, InputTextareaModule, InputNumberModule,
    ToastModule, TooltipModule, DividerModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    <p-dialog header="📥 上报环境记录（模拟传感器）" [(visible)]="showReportDlg" [modal]="true" [style]="{ width: '460px' }">
      <form [formGroup]="reportForm" class="space-y-4">
        <div>
          <label class="field-label">温湿度箱编号 <span class="text-red-500">*</span></label>
          <input type="text" pInputText formControlName="chamber_id" placeholder="如：STB-001" class="w-full">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">温度(℃) <span class="text-red-500">*</span></label>
            <p-inputNumber formControlName="temperature" mode="decimal" [minFractionDigits]="2" [step]="0.1" class="w-full"></p-inputNumber>
          </div>
          <div>
            <label class="field-label">湿度(%RH)</label>
            <p-inputNumber formControlName="humidity" mode="decimal" [minFractionDigits]="1" [step]="1" class="w-full"></p-inputNumber>
          </div>
        </div>
        <div>
          <label class="field-label">关联条件ID</label>
          <p-inputNumber formControlName="condition_id" mode="decimal" class="w-full"></p-inputNumber>
        </div>
        <div>
          <label class="field-label">记录时间</label>
          <p-calendar formControlName="recorded_at" showTime [showSeconds]="true" dateFormat="yy-mm-dd" timeFormat="HH:mm:ss" styleClass="w-full"></p-calendar>
        </div>
      </form>
      <div class="flex justify-end gap-2 mt-5">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showReportDlg = false"></button>
        <button pButton label="提交" (click)="doReport()"></button>
      </div>
    </p-dialog>

    <div class="space-y-6">
      <div class="card">
        <div class="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h2 class="page-title">🌡️ 温湿度实时监控</h2>
            <p class="page-subtitle">环境记录上报、异常实时警报、历史数据追溯</p>
          </div>
          <div class="flex gap-2">
            <a routerLink="/environment/alerts" pButton icon="pi pi-bell" label="警报中心">
              <span *ngIf="unackCount() > 0" class="ml-2 bg-red-500 text-white px-2 rounded-full text-xs">{{ unackCount() }}</span>
            </a>
            <button *ngIf="auth.hasRole(['warehouse','qa','admin'])"
              pButton label="📥 手动上报记录" icon="pi pi-plus"
              (click)="showReportDlg = true" class="p-button-outlined"></button>
            <button *ngIf="auth.hasRole(['admin','qa'])"
              pButton label="🤖 生成模拟数据" icon="pi pi-sync"
              [styleClass]="simulating() ? 'p-button-help' : 'p-button'"
              [loading]="simulating()"
              (click)="toggleSimulate()"></button>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div class="stat-card border-l-4" style="border-left-color: #16a34a;">
            <div class="flex justify-between items-start">
              <div>
                <div class="stat-label">温湿度箱总数</div>
                <div class="stat-value text-green-700">{{ chamberCount() }}</div>
              </div>
              <span class="text-3xl text-green-500">📦</span>
            </div>
            <div class="text-xs text-gray-500 mt-2">近24小时有记录: {{ activeChamberCount() }}</div>
          </div>
          <div class="stat-card border-l-4" style="border-left-color: #3b82f6;">
            <div class="flex justify-between items-start">
              <div>
                <div class="stat-label">今日记录数</div>
                <div class="stat-value text-blue-700">{{ todayRecords() }}</div>
              </div>
              <span class="text-3xl text-blue-500">📊</span>
            </div>
            <div class="text-xs text-gray-500 mt-2">最近1条: {{ lastRecordTime() }}</div>
          </div>
          <div class="stat-card border-l-4" style="border-left-color: #f59e0b;">
            <div class="flex justify-between items-start">
              <div>
                <div class="stat-label">警告级警报</div>
                <div class="stat-value text-yellow-700">{{ warningCount() }}</div>
              </div>
              <span class="text-3xl text-yellow-500">⚠️</span>
            </div>
            <div class="text-xs text-gray-500 mt-2">未确认: {{ warningUnack() }}</div>
          </div>
          <div class="stat-card border-l-4" style="border-left-color: #dc2626;">
            <div class="flex justify-between items-start">
              <div>
                <div class="stat-label">严重级警报</div>
                <div class="stat-value text-red-700">{{ criticalCount() }}</div>
              </div>
              <span class="text-3xl text-red-500">🚨</span>
            </div>
            <div class="text-xs text-gray-500 mt-2">未确认: {{ criticalUnack() }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <form [formGroup]="filterForm" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
          <div>
            <label class="field-label">温湿度箱</label>
            <p-dropdown formControlName="chamber_id" [options]="chamberOptions()" optionLabel="label" optionValue="value"
              [showClear]="true" placeholder="全部箱" styleClass="w-full" [filter]="true"></p-dropdown>
          </div>
          <div>
            <label class="field-label">起始日期</label>
            <p-calendar formControlName="start_date" dateFormat="yy-mm-dd" styleClass="w-full"></p-calendar>
          </div>
          <div>
            <label class="field-label">结束日期</label>
            <p-calendar formControlName="end_date" dateFormat="yy-mm-dd" styleClass="w-full"></p-calendar>
          </div>
          <div>
            <label class="field-label">仅显示异常</label>
            <p-dropdown formControlName="abnormal_only" [options]="[{label:'全部',value:false},{label:'仅异常',value:true}]"
              optionLabel="label" optionValue="value" styleClass="w-full"></p-dropdown>
          </div>
          <div class="flex items-end gap-2">
            <button pButton label="查询" icon="pi pi-search" (click)="loadData()"></button>
            <button pButton label="重置" styleClass="p-button-outlined" icon="pi pi-refresh"
              (click)="filterForm.reset({abnormal_only:false}); loadData()"></button>
          </div>
        </form>

        <h3 class="section-title">📋 环境记录明细</h3>
        @if (loading()) {
          <div class="text-center py-16"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
        } @else {
          <p-table [value]="records()" [paginator]="true" [rows]="20" [rowsPerPageOptions]="[20, 50, 100]"
            responsiveLayout="scroll" size="small" [tableStyle]="{ 'min-width': '70rem' }">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:40px;">#</th>
                <th>时间</th>
                <th>温湿度箱</th>
                <th>温度℃</th>
                <th>湿度%RH</th>
                <th>温度偏差</th>
                <th>湿度偏差</th>
                <th>关联警报</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-r let-ri="rowIndex">
              <tr [style]="{ background: r.has_deviation ? '#fef2f2' : r.temp_deviation || r.humidity_deviation ? '#fffbeb' : '' }">
                <td>{{ ri + 1 }}</td>
                <td class="text-xs">{{ r.recorded_at?.slice(0,19).replace('T',' ') }}</td>
                <td><b>{{ r.chamber_id }}</b></td>
                <td [style]="{ color: r.temp_deviation ? '#dc2626' : '#16a34a', fontWeight: r.temp_deviation ? 700 : 400 }">
                  {{ r.temperature }}
                </td>
                <td [style]="{ color: r.humidity_deviation ? '#dc2626' : '#16a34a', fontWeight: r.humidity_deviation ? 700 : 400 }">
                  {{ r.humidity ?? '-' }}
                </td>
                <td>
                  <span *ngIf="r.temp_deviation" class="badge" [ngClass]="alertSeverity(r.temp_deviation_alert_level)">
                    {{ r.temp_deviation.toFixed(2) }}℃
                  </span>
                </td>
                <td>
                  <span *ngIf="r.humidity_deviation" class="badge" [ngClass]="alertSeverity(r.humidity_deviation_alert_level)">
                    {{ r.humidity_deviation.toFixed(1) }}%
                  </span>
                </td>
                <td>
                  <a *ngIf="r.alert_count > 0" [routerLink]="['/environment/alerts']" [queryParams]="{chamber: r.chamber_id}">
                    <span class="badge badge-danger">{{ r.alert_count }} 警报</span>
                  </a>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="8">
                <div class="empty-state"><i class="pi pi-temperature-high"></i>
                  <h3>暂无环境记录</h3><p>启动模拟或使用传感器上报数据</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>
  `
})
export class EnvironmentMonitoringComponent implements OnInit {
  loading = signal(true);
  records = signal<any[]>([]);
  unackCount = signal(0);
  warningCount = signal(0);
  criticalCount = signal(0);
  warningUnack = signal(0);
  criticalUnack = signal(0);
  chamberCount = signal(0);
  activeChamberCount = signal(0);
  todayRecords = signal(0);
  lastRecordTime = signal('-');
  simulating = signal(false);
  showReportDlg = false;
  chamberOptions = signal<any[]>([]);

  filterForm = new FormGroup({
    chamber_id: new FormControl(''),
    start_date: new FormControl<Date | null>(null),
    end_date: new FormControl<Date | null>(null),
    abnormal_only: new FormControl(false),
  });

  reportForm = new FormGroup({
    chamber_id: new FormControl('STB-001'),
    temperature: new FormControl<number>(25.0),
    humidity: new FormControl<number | null>(60),
    condition_id: new FormControl<number | null>(null),
    recorded_at: new FormControl<Date>(new Date()),
  });

  private _simTimer: any = null;

  constructor(
    public auth: AuthService,
    private env: EnvironmentService,
    private message: MessageService,
  ) {
    this.filterForm.valueChanges.subscribe(() => {});
  }

  ngOnInit(): void {
    this.loadData();
    this.loadAlerts();
  }

  fmt(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  loadData() {
    this.loading.set(true);
    const f: any = { limit: 500 };
    if (this.filterForm.value.chamber_id) f.chamber_id = this.filterForm.value.chamber_id;
    if (this.filterForm.value.start_date) f.start_date = this.fmt(new Date(this.filterForm.value.start_date as any));
    if (this.filterForm.value.end_date) f.end_date = this.fmt(new Date(this.filterForm.value.end_date as any));
    if (this.filterForm.value.abnormal_only) f.has_deviation_only = true;

    this.env.listRecords(f).subscribe({
      next: (list) => {
        this.records.set(list);
        const chambers = new Map<string, number>();
        list.forEach(r => chambers.set(r.chamber_id, (chambers.get(r.chamber_id) || 0) + 1));
        this.chamberOptions.set(Array.from(chambers.keys()).map(k => ({ label: `${k} (${chambers.get(k)}条)`, value: k })));
        this.chamberCount.set(chambers.size);

        const today = this.fmt(new Date());
        const todayList = list.filter(r => r.recorded_at && r.recorded_at.slice(0, 10) === today);
        this.todayRecords.set(todayList.length);
        if (list.length > 0) this.lastRecordTime.set(list[0].recorded_at?.slice(5,16).replace('T',' ') || '-');

        const active = new Set();
        const now = new Date().getTime();
        list.forEach(r => {
          if (r.recorded_at) {
            const t = new Date(r.recorded_at.replace(' ', 'T')).getTime();
            if ((now - t) / 3600000 < 24) active.add(r.chamber_id);
          }
        });
        this.activeChamberCount.set(active.size);

        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadAlerts() {
    this.env.listAlerts({ limit: 1000 }).subscribe(list => {
      this.warningCount.set(list.filter(a => a.level === 'warning').length);
      this.criticalCount.set(list.filter(a => a.level === 'critical').length);
      this.warningUnack.set(list.filter(a => a.level === 'warning' && !a.acknowledged).length);
      this.criticalUnack.set(list.filter(a => a.level === 'critical' && !a.acknowledged).length);
      this.unackCount.set(list.filter(a => !a.acknowledged).length);
    });
  }

  alertSeverity(l: AlertLevel | undefined): string {
    if (!l) return 'badge-secondary';
    return { info: 'badge-info', warning: 'badge-warning', critical: 'badge-danger' }[l] || 'badge';
  }

  doReport() {
    const v: any = this.reportForm.value;
    const payload: any = {
      chamber_id: v.chamber_id,
      temperature: v.temperature,
      humidity: v.humidity,
      recorded_at: this.fmtDate(new Date(v.recorded_at)),
    };
    if (v.condition_id) payload.condition_id = v.condition_id;

    this.env.createRecord(payload).subscribe({
      next: () => {
        this.message.add({ severity: 'success', summary: '上报成功' });
        this.showReportDlg = false;
        this.loadData();
        this.loadAlerts();
      },
      error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }

  fmtDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  toggleSimulate() {
    if (this._simTimer) {
      clearInterval(this._simTimer); this._simTimer = null; this.simulating.set(false);
      this.message.add({ severity: 'info', summary: '已停止模拟' });
      return;
    }
    this.simulating.set(true);
    this.message.add({ severity: 'info', summary: '启动模拟', detail: '每10秒为 STB-001~003 生成随机温湿度（10%概率超限）' });
    let tick = 0;
    const chambers = ['STB-001', 'STB-002', 'STB-003'];
    this._simTimer = setInterval(() => {
      tick++;
      const chamber = chambers[tick % 3];
      const base: Record<string, {t: number; h: number}> = {
        'STB-001': { t: 25, h: 60 }, 'STB-002': { t: 40, h: 75 }, 'STB-003': { t: 5, h: 45 }
      };
      const b = base[chamber];
      const isBad = Math.random() < 0.12;
      const temp = isBad
        ? b.t + (Math.random() * 4 - 2) * 2.5
        : b.t + (Math.random() - 0.5) * 1.5;
      const hum = isBad
        ? b.h + (Math.random() * 10 - 5) * 2.5
        : b.h + (Math.random() - 0.5) * 6;

      this.env.createRecord({
        chamber_id: chamber,
        temperature: Number(temp.toFixed(2)),
        humidity: Number(hum.toFixed(1)),
        recorded_at: this.fmtDate(new Date()),
      }).subscribe({
        next: (r: any) => {
          if (r?.created_alert) {
            this.message.add({
              severity: 'warn', summary: `警报: ${chamber}`, detail: `温度 ${temp.toFixed(1)}℃ / 湿度 ${hum.toFixed(0)}%RH`
            });
            this.loadAlerts();
          }
          if (tick % 3 === 0) this.loadData();
        }
      });
    }, 8000);
  }
}
