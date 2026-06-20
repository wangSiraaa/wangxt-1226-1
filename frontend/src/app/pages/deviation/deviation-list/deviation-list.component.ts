import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { DeviationService } from '../../../shared/services/deviation.service';
import { AuthService } from '../../../shared/services/auth.service';
import { DeviationStatus, DeviationSeverity, DeviationCategory } from '../../../shared/models';

@Component({
  selector: 'app-deviation-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, TableModule, TagModule,
    DropdownModule, InputTextModule, ToastModule, TooltipModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <div class="card">
        <div class="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h2 class="page-title">🔍 偏差调查管理 (CAPA)</h2>
            <p class="page-subtitle">环境偏差、OOS/OOT、取样超窗等异常事件的调查处理和 CAPA 追踪</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button *ngIf="auth.hasRole(['qa','admin'])"
              pButton label="新建偏差报告" icon="pi pi-plus"
              style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;"
              routerLink="/deviations/new"></button>
          </div>
        </div>

        <div class="grid-5 mt-6 mb-5 gap-3">
          <div class="stat-mini border-l-4" style="border-left-color: #6366f1;">
            <div class="text-xs text-gray-500">偏差总数</div>
            <div class="text-2xl font-bold text-indigo-600">{{ total() }}</div>
          </div>
          <div class="stat-mini border-l-4" style="border-left-color: #ef4444;">
            <div class="text-xs text-gray-500">🔴 严重</div>
            <div class="text-2xl font-bold text-red-600">{{ critical() }}</div>
          </div>
          <div class="stat-mini border-l-4" style="border-left-color: #f59e0b;">
            <div class="text-xs text-gray-500">🟠 调查中</div>
            <div class="text-2xl font-bold text-orange-600">{{ investigating() }}</div>
          </div>
          <div class="stat-mini border-l-4" style="border-left-color: #3b82f6;">
            <div class="text-xs text-gray-500">🔵 CAPA验证</div>
            <div class="text-2xl font-bold text-blue-600">{{ capa() }}</div>
          </div>
          <div class="stat-mini border-l-4" style="border-left-color: #10b981;">
            <div class="text-xs text-gray-500">✅ 已关闭</div>
            <div class="text-2xl font-bold text-green-600">{{ closed() }}</div>
          </div>
        </div>

        <form [formGroup]="f" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div>
            <label class="field-label">编号/标题</label>
            <input type="text" pInputText formControlName="kw" placeholder="搜索..." class="w-full">
          </div>
          <div>
            <label class="field-label">严重度</label>
            <p-dropdown formControlName="severity" [showClear]="true" placeholder="全部" styleClass="w-full"
              [options]="[{label:'轻微',value:'minor'},{label:'主要',value:'major'},{label:'严重',value:'critical'}]"
              optionLabel="label" optionValue="value"></p-dropdown>
          </div>
          <div>
            <label class="field-label">类别</label>
            <p-dropdown formControlName="category" [showClear]="true" placeholder="全部" styleClass="w-full"
              [options]="[
                {label:'温湿度偏差',value:'environment_temperature_humidity'},
                {label:'OOS结果',value:'out_of_specification'},
                {label:'取样超窗',value:'sampling_window_violation'},
                {label:'设备异常',value:'equipment'},
                {label:'物料异常',value:'material'},
                {label:'其他',value:'other'}
              ]" optionLabel="label" optionValue="value"></p-dropdown>
          </div>
          <div>
            <label class="field-label">状态</label>
            <p-dropdown formControlName="status" [showClear]="true" placeholder="全部" styleClass="w-full"
              [options]="[
                {label:'已报告',value:'reported'},{label:'调查中',value:'under_investigation'},
                {label:'CAPA验证',value:'capa_verification'},{label:'已关闭',value:'closed'},
                {label:'已取消',value:'cancelled'},{label:'完成',value:'completed'}
              ]" optionLabel="label" optionValue="value"></p-dropdown>
          </div>
          <div class="flex items-end gap-2">
            <button pButton icon="pi pi-search" label="查询" (click)="apply()"></button>
            <button pButton icon="pi pi-refresh" styleClass="p-button-outlined" (click)="f.reset(); apply()"></button>
          </div>
        </form>
      </div>

      <div class="card">
        @if (loading()) {
          <div class="text-center py-16"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
        } @else {
          <p-table [value]="filtered()" [paginator]="true" [rows]="15" [rowsPerPageOptions]="[15, 30, 60]"
            responsiveLayout="scroll" size="small" [tableStyle]="{'min-width':'95rem'}">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:130px;">偏差编号</th>
                <th>标题 / 描述</th>
                <th style="width:120px;">类别</th>
                <th style="width:90px;">严重度</th>
                <th style="width:90px;">状态</th>
                <th style="width:100px;">关联样品</th>
                <th style="width:100px;">处理人</th>
                <th style="width:130px;">创建/发现</th>
                <th style="width:140px;" class="text-center">操作</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-d>
              <tr [style]="{ background: d.severity === 'critical' ? '#fef2f2' : d.severity === 'major' ? '#fffbeb' : '' }">
                <td>
                  <a [routerLink]="['/deviations', d.id]"><b class="text-blue-700">{{ d.deviation_code || 'DEV#' + d.id }}</b></a>
                </td>
                <td>
                  <div class="font-medium text-gray-800">{{ d.title }}</div>
                  <div class="text-xs text-gray-500 mt-1 line-clamp-1">{{ d.description }}</div>
                </td>
                <td><span class="badge badge-secondary text-xs">{{ categoryLabel(d.category) }}</span></td>
                <td>
                  <span class="badge" [ngClass]="{
                    'badge-danger': d.severity === 'critical',
                    'badge-warning': d.severity === 'major',
                    'badge-info': d.severity === 'minor'
                  }">{{ severityLabel(d.severity) }}</span>
                </td>
                <td>
                  <span class="badge" [ngClass]="statusClass(d.status)">{{ statusLabel(d.status) }}</span>
                </td>
                <td>
                  <span *ngIf="d.affected_samples_count" class="badge badge-danger">🔒 {{ d.affected_samples_count }}</span>
                  <span *ngIf="!d.affected_samples_count" class="text-gray-400 text-xs">无</span>
                </td>
                <td class="text-xs">{{ d.handled_by_name || (d.handled_by ? '#' + d.handled_by : '未指派') }}</td>
                <td class="text-xs">{{ (d.discovered_at || d.created_at)?.slice(0,16).replace('T',' ') }}</td>
                <td class="text-center">
                  <a [routerLink]="['/deviations', d.id]" pButton icon="pi pi-eye" class="p-button-text p-button-sm" pTooltip="详情"></a>
                  <button *ngIf="d.status === 'reported' && auth.hasRole(['qa','admin'])"
                    pButton icon="pi pi-play" class="p-button-text p-button-sm" (click)="startInvestigation(d)" pTooltip="启动调查"></button>
                  <button *ngIf="['reported','under_investigation'].includes(d.status) && !d.handled_by && auth.hasRole(['qa','admin'])"
                    pButton icon="pi pi-user-plus" class="p-button-text p-button-sm p-button-info" (click)="assignMe(d)" pTooltip="指派给我"></button>
                  <button *ngIf="['capa_verification','completed'].includes(d.status) && auth.hasRole(['qa','admin'])"
                    pButton icon="pi pi-check-circle" class="p-button-text p-button-sm p-button-success" (click)="quickClose(d)" pTooltip="关闭"></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="9">
                <div class="empty-state"><i class="pi pi-search"></i>
                  <h3>暂无偏差记录</h3><p>启动调查流程后会自动创建偏差</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>
  `
})
export class DeviationListComponent implements OnInit {
  loading = signal(true);
  all = signal<any[]>([]);
  filtered = signal<any[]>([]);
  total = signal(0); critical = signal(0); investigating = signal(0); capa = signal(0); closed = signal(0);

  f = new FormGroup({
    kw: new FormControl(''),
    severity: new FormControl(''),
    category: new FormControl(''),
    status: new FormControl(''),
  });

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private svc: DeviationService,
    private message: MessageService,
  ) {
    this.route.queryParams.subscribe(q => {
      if (q['tr']) this.f.patchValue({ category: 'out_of_specification' });
    });
  }

  ngOnInit(): void { this.apply(); }

  apply() {
    this.loading.set(true);
    const params: any = { limit: 500 };
    if (this.f.value.severity) params.severity = this.f.value.severity;
    if (this.f.value.category) params.category = this.f.value.category;
    if (this.f.value.status) params.status = this.f.value.status as DeviationStatus;

    this.svc.list(params).subscribe({
      next: (list) => {
        const kw = (this.f.value.kw || '').toLowerCase();
        const fd = list.filter(d => {
          if (kw && !(d.deviation_code + ' ' + d.title + ' ' + (d.description || '')).toLowerCase().includes(kw)) return false;
          return true;
        });
        this.all.set(list);
        this.filtered.set(fd);
        this.total.set(list.length);
        this.critical.set(list.filter(d => d.severity === 'critical').length);
        this.investigating.set(list.filter(d => ['reported','under_investigation'].includes(d.status)).length);
        this.capa.set(list.filter(d => d.status === 'capa_verification').length);
        this.closed.set(list.filter(d => ['closed','completed'].includes(d.status)).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  severityLabel(s: DeviationSeverity): string {
    return { minor: '轻微', major: '主要', critical: '严重' }[s] || s;
  }
  categoryLabel(c: DeviationCategory): string {
    return {
      environment_temperature_humidity: '温湿度偏差', out_of_specification: 'OOS结果',
      sampling_window_violation: '取样超窗', equipment: '设备异常',
      material: '物料异常', process: '工艺异常', documentation: '文件记录',
      personnel: '人员操作', laboratory: '实验室', other: '其他'
    }[c] || c;
  }
  statusClass(s: DeviationStatus): string {
    return {
      reported: 'badge-info', under_investigation: 'badge-warning', root_cause_identified: 'badge-info',
      capa_implemented: 'badge-primary', capa_verification: 'badge-secondary',
      closed: 'badge-success', completed: 'badge-success', cancelled: 'badge-dark'
    }[s] || 'badge';
  }
  statusLabel(s: DeviationStatus): string {
    return {
      reported: '已报告', under_investigation: '调查中', root_cause_identified: '已定位原因',
      capa_implemented: '已实施CAPA', capa_verification: 'CAPA验证',
      closed: '已关闭', completed: '完成', cancelled: '已取消'
    }[s] || s;
  }

  startInvestigation(d: any) {
    this.svc.updateStatus(d.id, { status: 'under_investigation', remarks: '启动正式调查' }).subscribe({
      next: () => { this.message.add({ severity:'success', summary:'已启动调查' }); this.apply(); }
    });
  }

  assignMe(d: any) {
    if (!this.auth.currentUser?.id) return;
    this.svc.assign(d.id, { handled_by: this.auth.currentUser!.id }).subscribe({
      next: () => { this.message.add({ severity:'success', summary:'已指派给我' }); this.apply(); }
    });
  }

  quickClose(d: any) {
    this.svc.close(d.id, { final_conclusion: '快速关闭：调查已完成', conclusion_date: this.today(), effectiveness_check: '验证通过' }).subscribe({
      next: () => { this.message.add({ severity:'success', summary:'已关闭并解锁样品' }); this.apply(); }
    });
  }

  today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
}
