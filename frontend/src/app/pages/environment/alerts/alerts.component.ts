import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { DividerModule } from 'primeng/divider';
import { MessageService, ConfirmationService } from 'primeng/api';
import { EnvironmentService } from '../../../shared/services/environment.service';
import { DeviationService } from '../../../shared/services/deviation.service';
import { AuthService } from '../../../shared/services/auth.service';
import { AlertLevel } from '../../../shared/models';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, TableModule, TagModule,
    DropdownModule, DialogModule, InputTextareaModule, ToastModule, TooltipModule, ConfirmDialogModule,
    CheckboxModule, InputTextModule, DividerModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog key="confirm"></p-confirmDialog>

    <p-dialog header="处理环境警报" [(visible)]="showDlg" [modal]="true" [style]="{ width: '540px' }">
      <div *ngIf="selectedAlert()" class="space-y-4">
        <div class="p-4 rounded-lg" [ngClass]="selectedAlert()!.level === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-3xl">{{ selectedAlert()!.level === 'critical' ? '🚨' : '⚠️' }}</span>
            <div>
              <div class="font-bold" [ngClass]="selectedAlert()!.level === 'critical' ? 'text-red-700' : 'text-yellow-700'">
                {{ selectedAlert()!.chamber_id }} · {{ selectedAlert()!.parameter_name }} {{ selectedAlert()!.parameter_name === 'temperature' ? '温度' : '湿度' }}异常
              </div>
              <div class="text-xs mt-1 text-gray-600">
                实际值 <b>{{ selectedAlert()!.actual_value }}</b>
                · 超出限制 <b>{{ selectedAlert()!.deviation_value || '?' }}</b>
                · 持续 <b>{{ selectedAlert()!.duration_minutes }}</b> 分钟
              </div>
            </div>
          </div>
          <div class="text-xs text-gray-500 bg-white/60 p-2 rounded">
            起始时间：{{ selectedAlert()!.triggered_at?.slice(0,19).replace('T',' ') }} · 结束时间：{{ selectedAlert()!.resolved_at?.slice(0,19).replace('T',' ') || '持续中' }}
          </div>
        </div>

        <form [formGroup]="ackForm">
          <div>
            <label class="field-label">处理备注 <span class="text-red-500">*</span></label>
            <textarea pInputTextarea formControlName="acknowledge_remark" [rows]="4" class="w-full"
              placeholder="如：已校准传感器 / 已通知设备维修 / 温湿度已恢复正常范围 ..."></textarea>
          </div>
          <div>
            <label class="field-label">QA 动作</label>
            <p-checkbox formControlName="create_deviation" [binary]="true" label="同步创建偏差调查报告（会自动锁定该温湿度箱下的样品）"
              class="block"></p-checkbox>
            <div *ngIf="ackForm.value.create_deviation" class="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-700">
              <div class="font-semibold mb-1">ℹ️ 创建偏差将自动：</div>
              <ul class="list-disc list-inside space-y-0.5">
                <li>生成偏差报告，类型：environment_temperature_humidity</li>
                <li>自动锁定该温湿度箱关联的样品（需 QA 手工解锁）</li>
                <li>通知 QA 团队进行进一步调查处理</li>
              </ul>
            </div>
          </div>
        </form>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showDlg = false"></button>
        <button pButton label="确认处理" [disabled]="!ackForm.valid" (click)="doAck()"></button>
      </div>
    </p-dialog>

    <div class="space-y-6">
      <div class="card">
        <div class="page-header flex-wrap">
          <div>
            <h2 class="page-title">🚨 环境警报处理中心</h2>
            <p class="page-subtitle">温湿度超限警报确认、升级偏差调查、CAPA追踪</p>
          </div>
          <div class="flex gap-2">
            <a routerLink="/environment" pButton label="监控仪表盘" icon="pi pi-chart-line" class="p-button-outlined"></a>
            <a routerLink="/deviations" pButton label="偏差调查" icon="pi pi-search" class="p-button-help"></a>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <div class="stat-mini"><div class="text-xs text-gray-500">警报总数</div><div class="text-2xl font-bold">{{ total() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">未确认</div><div class="text-2xl font-bold text-red-600">{{ unack() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">🔴 严重</div><div class="text-2xl font-bold text-red-600">{{ critical() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">🟡 警告</div><div class="text-2xl font-bold text-yellow-600">{{ warning() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">已转偏差</div><div class="text-2xl font-bold text-purple-600">{{ deviated() }}</div></div>
        </div>
      </div>

      <div class="card">
        <form [formGroup]="filterForm" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
          <div>
            <label class="field-label">温湿度箱</label>
            <input type="text" pInputText formControlName="chamber_id" placeholder="如 STB-001" class="w-full">
          </div>
          <div>
            <label class="field-label">级别</label>
            <p-dropdown formControlName="level" [options]="[
              {label:'全部', value: ''},
              {label:'信息', value: 'info'},
              {label:'警告', value: 'warning'},
              {label:'严重', value: 'critical'},
            ]" optionLabel="label" optionValue="value" styleClass="w-full"></p-dropdown>
          </div>
          <div>
            <label class="field-label">确认状态</label>
            <p-dropdown formControlName="acknowledged" [options]="[
              {label:'全部', value: ''},
              {label:'未确认', value: 'false'},
              {label:'已确认', value: 'true'},
            ]" optionLabel="label" optionValue="value" styleClass="w-full"></p-dropdown>
          </div>
          <div class="md:col-span-2 flex items-end gap-2">
            <button pButton label="查询" icon="pi pi-search" (click)="load()"></button>
            <button pButton label="重置" styleClass="p-button-outlined" icon="pi pi-refresh"
              (click)="filterForm.reset(); load()"></button>
          </div>
        </form>

        @if (loading()) {
          <div class="text-center py-16"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
        } @else {
          <p-table [value]="alerts()" [paginator]="true" [rows]="15" responsiveLayout="scroll" size="small"
            [sortField]="'triggered_at'" [sortOrder]="-1" [tableStyle]="{ 'min-width': '90rem' }">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:50px;">ID</th>
                <th pSortableColumn="triggered_at">触发时间 <p-sortIcon field="triggered_at"></p-sortIcon></th>
                <th>温湿度箱</th>
                <th>参数</th>
                <th>实际值</th>
                <th>超出量</th>
                <th>持续</th>
                <th>级别</th>
                <th>确认状态</th>
                <th>已转偏差</th>
                <th style="width:140px;" class="text-center">操作</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-a>
              <tr [style]="{ background: !a.acknowledged ? (a.level === 'critical' ? '#fef2f2' : '#fffbeb') : '' }">
                <td>#{{ a.id }}</td>
                <td>{{ a.triggered_at?.slice(0,19).replace('T',' ') }}</td>
                <td><b>{{ a.chamber_id }}</b></td>
                <td>{{ a.parameter_name === 'temperature' ? '🌡️ 温度' : '💧 湿度' }}</td>
                <td class="font-bold text-red-600">{{ a.actual_value }}</td>
                <td>{{ a.deviation_value || '-' }}</td>
                <td>{{ a.duration_minutes }} 分钟</td>
                <td>
                  <p-tag [severity]="a.level === 'critical' ? 'danger' : a.level === 'warning' ? 'warning' : 'info'"
                    [value]="a.level === 'critical' ? '严重' : a.level === 'warning' ? '警告' : '信息'"></p-tag>
                </td>
                <td>
                  <span *ngIf="a.acknowledged" class="badge badge-success">
                    ✅ {{ a.acknowledged_by_name || '已确认' }}
                  </span>
                  <span *ngIf="!a.acknowledged" class="badge badge-danger">⏳ 待处理</span>
                </td>
                <td>
                  <a *ngIf="a.linked_deviation_id" [routerLink]="['/deviations', a.linked_deviation_id]">
                    <span class="badge badge-secondary">偏差 #{{ a.linked_deviation_id }}</span>
                  </a>
                </td>
                <td class="text-center">
                  <button *ngIf="!a.acknowledged && auth.hasRole(['qa','warehouse','admin'])"
                    pButton icon="pi pi-check" class="p-button-sm p-button-text p-button-success"
                    (click)="openAckDlg(a)" pTooltip="处理/确认" tooltipPosition="left"></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="11">
                <div class="empty-state"><i class="pi pi-check-circle text-green-500 text-4xl"></i>
                  <h3>暂无待处理警报</h3><p>所有温湿度环境记录均在正常范围</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>
  `
})
export class AlertsComponent implements OnInit {
  loading = signal(true);
  alerts = signal<any[]>([]);
  total = signal(0); unack = signal(0); critical = signal(0); warning = signal(0); deviated = signal(0);
  showDlg = false;
  selectedAlert = signal<any>(null);

  filterForm = new FormGroup({
    chamber_id: new FormControl(''),
    level: new FormControl(''),
    acknowledged: new FormControl(''),
  });

  ackForm = new FormGroup({
    acknowledge_remark: new FormControl('', Validators.required),
    create_deviation: new FormControl(false),
  });

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private env: EnvironmentService,
    private deviation: DeviationService,
    private message: MessageService,
    private confirm: ConfirmationService,
  ) {
    this.route.queryParams.subscribe(q => {
      if (q['chamber']) this.filterForm.patchValue({ chamber_id: String(q['chamber']) });
    });
  }

  ngOnInit(): void { this.load(); }

  load() {
    this.loading.set(true);
    const f: any = { limit: 500 };
    if (this.filterForm.value.chamber_id) f.chamber_id = this.filterForm.value.chamber_id;
    if (this.filterForm.value.level) f.level = this.filterForm.value.level as AlertLevel;
    if (this.filterForm.value.acknowledged === 'true') f.acknowledged = true;
    if (this.filterForm.value.acknowledged === 'false') f.acknowledged = false;

    this.env.listAlerts(f).subscribe({
      next: (list) => {
        this.alerts.set(list);
        this.total.set(list.length);
        this.unack.set(list.filter(a => !a.acknowledged).length);
        this.critical.set(list.filter(a => a.level === 'critical').length);
        this.warning.set(list.filter(a => a.level === 'warning').length);
        this.deviated.set(list.filter(a => a.linked_deviation_id).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openAckDlg(a: any) {
    this.selectedAlert.set(a);
    this.ackForm.reset({ acknowledge_remark: '', create_deviation: a.level === 'critical' });
    this.showDlg = true;
  }

  doAck() {
    if (!this.ackForm.valid || !this.selectedAlert()) return;
    const v: any = this.ackForm.value;
    this.env.acknowledgeAlert(this.selectedAlert()!.id, {
      acknowledge_remark: v.acknowledge_remark,
      create_deviation: !!v.create_deviation,
    }).subscribe({
      next: (r: any) => {
        this.message.add({ severity: 'success', summary: '已处理' });
        this.showDlg = false;
        if (r?.deviation_id) {
          this.message.add({ severity: 'info', summary: '已同步创建偏差调查', detail: `偏差 #${r.deviation_id}` });
          setTimeout(() => this.router.navigate(['/deviations', r.deviation_id]), 800);
        } else this.load();
      },
      error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }
}
