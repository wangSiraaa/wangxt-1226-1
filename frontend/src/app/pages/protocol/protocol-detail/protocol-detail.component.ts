import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { FieldsetModule } from 'primeng/fieldset';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProtocolService } from '../../../shared/services/protocol.service';
import { SampleService } from '../../../shared/services/sample.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Protocol, ProtocolStatus } from '../../../shared/models';

@Component({
  selector: 'app-protocol-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TagModule, TabViewModule, TableModule,
    FieldsetModule, TooltipModule, ConfirmDialogModule, DialogModule, InputTextModule, InputNumberModule, ToastModule],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog key="confirm"></p-confirmDialog>
    <p-dialog header="为该方案批量生成样品" [(visible)]="showGenerateDlg" [modal]="true"
      [style]="{ width: '400px' }">
      <div class="space-y-3 py-2">
        <div>
          <label class="field-label">每种条件生成样品数</label>
          <p-inputNumber [(ngModel)]="generatePerCondition" [min]="1" [max]="50" mode="decimal" class="w-full"></p-inputNumber>
        </div>
        <div>
          <label class="field-label">编码前缀（可选）</label>
          <input type="text" pInputText [(ngModel)]="generatePrefix" placeholder="如：S2024" class="w-full">
        </div>
        <div class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          预计生成：<b>{{ protocol()?.storage_conditions?.length || 0 }}</b> 个条件 ×
          <b>{{ generatePerCondition }}</b> = <b class="text-blue-700">{{ (protocol()?.storage_conditions?.length || 0) * generatePerCondition }}</b> 个样品
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showGenerateDlg = false"></button>
        <button pButton label="生成样品" (click)="doGenerateSamples()" [loading]="generating()"></button>
      </div>
    </p-dialog>

    <div class="space-y-6">
      @if (loading()) {
        <div class="text-center py-20"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
      } @else if (!protocol()) {
        <div class="card text-center py-16 text-gray-500">方案不存在</div>
      } @else {
        <div class="card">
          <div class="flex justify-between items-start flex-wrap gap-4">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <a routerLink="/protocols" pButton icon="pi pi-arrow-left" class="p-button-text p-button-plain"></a>
                <h2 class="text-2xl font-bold text-gray-800 m-0">{{ protocol()!.protocol_code }}</h2>
                <span class="badge text-base px-3 py-1" [ngClass]="statusClass(protocol()!.status)">
                  {{ statusLabel(protocol()!.status) }}
                </span>
              </div>
              <div class="mt-2 text-gray-600">{{ protocol()!.title }}</div>
            </div>

            <div class="flex gap-2 flex-wrap">
              <button *ngIf="protocol()!.status === 'in_progress' && auth.hasRole(['warehouse', 'qa', 'admin'])"
                pButton label="生成样品" icon="pi pi-box"
                (click)="showGenerateDlg = true"></button>
              <button *ngIf="protocol()!.status === 'draft'"
                pButton label="编辑" icon="pi pi-pencil" styleClass="p-button-outlined"></button>
              <button *ngIf="protocol()!.status === 'draft' && (isOwner || auth.hasRole(['admin']))"
                pButton label="提交审批" icon="pi pi-check-circle" (click)="updateStatus('pending_approval', '提交审批')"></button>
              <button *ngIf="protocol()!.status === 'pending_approval' && auth.hasRole(['qa', 'admin'])"
                pButton label="批准激活" icon="pi pi-check" styleClass="p-button-success"
                (click)="updateStatus('in_progress', 'QA批准激活方案')"></button>
              <button *ngIf="protocol()!.status === 'pending_approval' && auth.hasRole(['qa', 'admin'])"
                pButton label="驳回" icon="pi pi-times" styleClass="p-button-danger p-button-outlined"
                (click)="updateStatus('rejected', 'QA驳回')"></button>
              <button *ngIf="['in_progress'].includes(protocol()!.status) && auth.hasRole(['qa', 'admin'])"
                pButton label="标记完成" icon="pi pi-flag" styleClass="p-button-help"
                (click)="updateStatus('completed', '方案完成')"></button>
            </div>
          </div>

          <div class="grid-4 mt-6 gap-3">
            <div class="info-item">
              <div class="info-label">产品名称</div>
              <div class="info-value">{{ protocol()!.product_name }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">批次号</div>
              <div class="info-value">{{ protocol()!.batch_number }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">规格</div>
              <div class="info-value">{{ protocol()!.specification || '-' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">包装</div>
              <div class="info-value">{{ protocol()!.package_type || '-' }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">试验类型</div>
              <div class="info-value"><p-tag [value]="protocol()!.study_type" severity="info"></p-tag></div>
            </div>
            <div class="info-item">
              <div class="info-label">总时长</div>
              <div class="info-value">{{ protocol()!.total_duration_months }} 个月</div>
            </div>
            <div class="info-item">
              <div class="info-label">开始日期</div>
              <div class="info-value">{{ protocol()!.start_date }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">预期结束</div>
              <div class="info-value">{{ protocol()!.expected_end_date }}</div>
            </div>
          </div>
        </div>

        <p-tabView [activeIndex]="tabIdx" (onChange)="tabIdx = $event.index">
          <p-tabPanel header="📦 储存条件">
            <div class="card">
              <p-table [value]="protocol()!.storage_conditions" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr>
                    <th>代码</th><th>条件名称</th><th>温度范围</th><th>湿度范围</th><th>光照</th><th>位置 / 温箱</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-c>
                  <tr>
                    <td><b>{{ c.condition_code }}</b></td>
                    <td>{{ c.condition_name }}</td>
                    <td>
                      <span class="badge badge-info">{{ c.temperature_min }} ~ {{ c.temperature_max }} ℃</span>
                      <span class="text-xs text-gray-500 ml-1">目标 {{ c.temperature_target }}</span>
                    </td>
                    <td>
                      <span *ngIf="c.humidity_min !== null && c.humidity_max !== null"
                        class="badge badge-success">{{ c.humidity_min }} ~ {{ c.humidity_max }}%RH</span>
                      <span *ngIf="c.humidity_min === null" class="text-gray-400 text-sm">无</span>
                    </td>
                    <td>{{ c.light_condition || '-' }}</td>
                    <td>{{ c.location }} / {{ c.chamber_id || '-' }}</td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabPanel>

          <p-tabPanel [header]="'⏱️ 取样时间点 (' + (protocol()!.sampling_timepoints?.length || 0) + ')'">
            <div class="card">
              <p-table [value]="protocol()!.sampling_timepoints" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr>
                    <th style="width:80px;">月数</th>
                    <th>标签</th>
                    <th>计划日期</th>
                    <th>取样窗口</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-t>
                  <tr>
                    <td><b>{{ t.timepoint_month }}M</b></td>
                    <td>{{ t.timepoint_label }}</td>
                    <td>{{ t.planned_date }}</td>
                    <td>±{{ t.window_before_days || 0 }} / +{{ t.window_after_days || 0 }} 天</td>
                    <td>
                      <span *ngIf="t.window_info" class="badge"
                        [ngClass]="t.window_info.is_urgent ? 'badge-danger' : t.window_info.is_within_window ? 'badge-success' : 'badge-info'">
                        {{ t.window_info.is_within_window ? '窗口内' : t.window_info.is_urgent ? '紧急' : '未开放' }}
                      </span>
                    </td>
                    <td>
                      <a *ngIf="t.window_info?.can_sample_now"
                        [routerLink]="['/samples']" [queryParams]="{ protocol: protocol()!.id, tp: t.id }"
                        pButton label="取样" icon="pi pi-sign-out" class="p-button-sm p-button-success"></a>
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabPanel>

          <p-tabPanel [header]="'🧪 样品列表 (' + samples().length + ')'">
            <div class="card">
              <div class="flex justify-between items-center mb-4">
                <div>
                  在箱：<b class="text-green-600">{{ sampleStats.inStorage }}</b> ·
                  已取出：<b class="text-blue-600">{{ sampleStats.out }}</b> ·
                  锁定：<b class="text-red-600">{{ sampleStats.locked }}</b>
                </div>
                <a [routerLink]="['/samples']" [queryParams]="{ protocol: protocol()!.id }"
                  pButton label="样品管理" icon="pi pi-external-link" class="p-button-sm p-button-outlined"></a>
              </div>

              <p-table [value]="samples()" [paginator]="true" [rows]="15" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr>
                    <th>样品编号</th><th>储存条件</th><th>位置</th><th>状态</th>
                    <th>锁定</th><th>入箱日期</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-s>
                  <tr>
                    <td><a [routerLink]="['/samples', s.id]"><b>{{ s.sample_code }}</b></a></td>
                    <td>{{ s.condition_name || s.condition_id }}</td>
                    <td>{{ s.chamber_position || '-' }}</td>
                    <td><span class="badge" [ngClass]="sampleStatusClass(s.status)">{{ sampleStatusLabel(s.status) }}</span></td>
                    <td>
                      <span *ngIf="s.is_locked" class="badge badge-danger">🔒 {{ s.lock_reason || '已锁定' }}</span>
                      <span *ngIf="!s.is_locked" class="text-green-600">✅</span>
                    </td>
                    <td>{{ s.in_chamber_at || '-' }}</td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabPanel>
        </p-tabView>
      }
    </div>
  `
})
export class ProtocolDetailComponent implements OnInit {
  id = Number(this.route.snapshot.params['id']);
  protocol = signal<Protocol | null>(null);
  samples = signal<any[]>([]);
  loading = signal(true);
  showGenerateDlg = false;
  generatePerCondition = 2;
  generatePrefix = '';
  generating = signal(false);
  tabIdx = 0;

  sampleStats = { inStorage: 0, out: 0, locked: 0 };

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private protocolSvc: ProtocolService,
    private sampleSvc: SampleService,
    private confirm: ConfirmationService,
    private message: MessageService,
  ) {}

  get isOwner(): boolean { return this.auth.currentUser?.id === this.protocol()?.created_by; }

  ngOnInit(): void {
    this.loadDetail();
  }

  loadDetail() {
    this.protocolSvc.get(this.id).subscribe({
      next: async (p) => {
        this.protocol.set(p);
        this.loadSamples();
        for (const tp of (p.sampling_timepoints || [])) {
          this.protocolSvc.getTimepointWindow(p.id, tp.id).subscribe({
            next: (wi) => { tp.window_info = wi; this.protocol.set({ ...this.protocol()! }); },
            error: () => {}
          });
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadSamples() {
    this.sampleSvc.list({ protocol_id: this.id, limit: 500 }).subscribe({
      next: (list) => {
        this.samples.set(list);
        this.sampleStats.inStorage = list.filter(s => s.status === 'in_storage').length;
        this.sampleStats.out = list.filter(s => ['sampled', 'destroyed'].includes(s.status)).length;
        this.sampleStats.locked = list.filter(s => s.is_locked).length;
      }
    });
  }

  statusClass(s: ProtocolStatus): string {
    return {
      draft: 'badge-secondary', pending_approval: 'badge-warning', in_progress: 'badge-info',
      completed: 'badge-success', rejected: 'badge-danger', archived: 'badge-dark'
    }[s] || 'badge';
  }
  statusLabel(s: ProtocolStatus): string {
    return { draft: '草稿', pending_approval: '待审批', in_progress: '进行中',
      completed: '已完成', rejected: '已驳回', archived: '已归档' }[s] || s;
  }

  sampleStatusClass(s: string): string {
    return { generated: 'badge-secondary', assigned: 'badge-light', in_storage: 'badge-success',
      out_for_sampling: 'badge-info', sampled: 'badge-primary', returned: 'badge-info',
      destroyed: 'badge-dark', quarantine: 'badge-warning' }[s] || 'badge';
  }
  sampleStatusLabel(s: string): string {
    return { generated: '已生成', assigned: '已分配', in_storage: '在储存',
      out_for_sampling: '取样中', sampled: '已取样', returned: '已归还',
      destroyed: '已销毁', quarantine: '隔离' }[s] || s;
  }

  updateStatus(status: ProtocolStatus, action: string) {
    this.confirm.confirm({
      key: 'confirm', header: action,
      message: `确定对「${this.protocol()!.protocol_code}」执行【${action}】？`,
      accept: () => this.protocolSvc.updateStatus(this.id, status, action).subscribe({
        next: (p) => { this.protocol.set(p); this.message.add({ severity: 'success', summary: '操作成功' }); },
        error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
      })
    });
  }

  doGenerateSamples() {
    if (!this.generatePerCondition) return;
    this.generating.set(true);
    this.sampleSvc.generate({
      protocol_id: this.id,
      samples_per_condition: this.generatePerCondition,
      code_prefix: this.generatePrefix || undefined
    }).subscribe({
      next: (res: any) => {
        this.showGenerateDlg = false; this.generating.set(false);
        this.message.add({ severity: 'success', summary: '生成成功', detail: `共生成 ${res.generated_count} 个样品` });
        this.loadSamples();
      },
      error: (e) => { this.generating.set(false);
        this.message.add({ severity: 'error', summary: '生成失败', detail: e.error?.detail }); }
    });
  }
}
