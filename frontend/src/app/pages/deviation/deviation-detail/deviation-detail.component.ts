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
import { TabViewModule } from 'primeng/tabview';
import { FieldsetModule } from 'primeng/fieldset';
import { TimelineModule } from 'primeng/timeline';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DeviationService } from '../../../shared/services/deviation.service';
import { AuthService } from '../../../shared/services/auth.service';
import { DeviationStatus, DeviationSeverity, DeviationCategory } from '../../../shared/models';

@Component({
  selector: 'app-deviation-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, TableModule, TagModule,
    DropdownModule, DialogModule, InputTextareaModule, ToastModule, TabViewModule, FieldsetModule,
    TimelineModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog key="confirm"></p-confirmDialog>

    <p-dialog header="指派处理人" [(visible)]="showAssignDlg" [modal]="true" [style]="{ width: '420px' }">
      <div class="space-y-3">
        <div class="p-3 bg-blue-50 rounded text-sm">当前处理人：<b>{{ dev()?.handled_by_name || '未指派' }}</b></div>
        <div>
          <label class="field-label">QA 处理人</label>
          <p-dropdown formControlName="handler_id" [options]="qaOptions" optionLabel="label" optionValue="id"
            styleClass="w-full" placeholder="选择处理人"></p-dropdown>
        </div>
        <div>
          <label class="field-label">指派备注</label>
          <textarea pInputTextarea formControlName="remarks" [rows]="2" class="w-full"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showAssignDlg = false"></button>
        <button pButton label="确认指派" (click)="doAssign()" [disabled]="assignForm.invalid"></button>
      </div>
    </p-dialog>

    <p-dialog header="更新偏差状态" [(visible)]="showStatusDlg" [modal]="true" [style]="{ width: '440px' }">
      <div class="space-y-3">
        <div>
          <label class="field-label">目标状态 <span class="text-red-500">*</span></label>
          <p-dropdown formControlName="status" [options]="statusFlow" optionLabel="label" optionValue="value" styleClass="w-full"></p-dropdown>
        </div>
        <div>
          <label class="field-label">状态变更备注 <span class="text-red-500">*</span></label>
          <textarea pInputTextarea formControlName="remarks" [rows]="3" class="w-full"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showStatusDlg = false"></button>
        <button pButton label="确认" [disabled]="statusForm.invalid" (click)="doStatus()"></button>
      </div>
    </p-dialog>

    <p-dialog header="登记 CAPA / 调查结论" [(visible)]="showConclusionDlg" [modal]="true" [style]="{ width: '480px' }">
      <div class="space-y-3">
        <div>
          <label class="field-label">结论类型</label>
          <p-dropdown formControlName="conclusion_type" [options]="[
            {label:'根本原因分析(RCA)',value:'root_cause'},
            {label:'纠正措施记录',value:'corrective'},
            {label:'预防措施记录',value:'preventive'},
            {label:'风险评估',value:'risk'},
            {label:'CAPA验证结果',value:'verification'},
            {label:'最终调查结论',value:'final'}
          ]" optionLabel="label" optionValue="value" styleClass="w-full"></p-dropdown>
        </div>
        <div>
          <label class="field-label">结论详情 <span class="text-red-500">*</span></label>
          <textarea pInputTextarea formControlName="conclusion_text" [rows]="5" class="w-full" placeholder="详细描述CAPA内容、执行情况、效果验证等"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showConclusionDlg = false"></button>
        <button pButton label="添加结论" [disabled]="conclusionForm.invalid" (click)="doConclusion()"></button>
      </div>
    </p-dialog>

    <p-dialog header="关闭偏差报告" [(visible)]="showCloseDlg" [modal]="true" [style]="{ width: '500px' }">
      <div class="space-y-3">
        <div class="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
          ✅ 关闭偏差将自动解锁所有受影响样品
        </div>
        <form [formGroup]="closeForm">
          <div>
            <label class="field-label">最终结论 <span class="text-red-500">*</span></label>
            <textarea pInputTextarea formControlName="final_conclusion" [rows]="4" class="w-full"
              placeholder="总结调查过程、原因定位、CAPA措施有效性、产品质量影响评估"></textarea>
          </div>
          <div>
            <label class="field-label">结论日期</label>
            <input type="date" formControlName="conclusion_date" pInputText class="w-full">
          </div>
          <div>
            <label class="field-label">CAPA 有效性检查 <span class="text-red-500">*</span></label>
            <textarea pInputTextarea formControlName="effectiveness_check" [rows]="3" class="w-full"
              placeholder="如：CAPA 措施已执行 3 个月，未再发生类似偏差，验证通过"></textarea>
          </div>
        </form>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showCloseDlg = false"></button>
        <button pButton label="关闭偏差 + 解锁样品" styleClass="p-button-success" [disabled]="closeForm.invalid" (click)="doClose()"></button>
      </div>
    </p-dialog>

    <div class="space-y-6">
      @if (loading()) {
        <div class="text-center py-20"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
      } @else if (!dev()) {
        <div class="card text-center py-16 text-gray-500">偏差不存在</div>
      } @else {
        <div class="card" [style]="{ border: dev()!.severity === 'critical' ? '2px solid #fee2e2' : dev()!.severity === 'major' ? '2px solid #fef3c7' : '' }">
          <div class="flex justify-between items-start flex-wrap gap-4 mb-5">
            <div class="flex items-center gap-3 flex-wrap">
              <a routerLink="/deviations" pButton icon="pi pi-arrow-left" class="p-button-text p-button-plain"></a>
              <div>
                <div class="flex items-center gap-3 flex-wrap mb-1">
                  <h2 class="text-2xl font-bold m-0 text-gray-800">{{ dev()!.deviation_code || 'DEV#' + dev()!.id }}</h2>
                  <span class="badge text-base px-3 py-1" [ngClass]="severityClass(dev()!.severity)">
                    {{ severityLabel(dev()!.severity) }}
                  </span>
                  <span class="badge text-base px-3 py-1" [ngClass]="statusClass(dev()!.status)">
                    {{ statusLabel(dev()!.status) }}
                  </span>
                  <span class="badge badge-secondary text-base px-3 py-1">
                    {{ categoryLabel(dev()!.category) }}
                  </span>
                </div>
                <div class="text-lg font-semibold text-gray-800 mt-2">{{ dev()!.title }}</div>
              </div>
            </div>

            <div class="flex gap-2 flex-wrap">
              <button *ngIf="!dev()!.handled_by && auth.hasRole(['qa','admin'])"
                pButton icon="pi pi-user-plus" label="指派处理人" (click)="openAssign()"></button>
              <button *ngIf="auth.hasRole(['qa','admin'])"
                pButton icon="pi pi-step-forward" label="更新状态" class="p-button-help" (click)="openStatus()"></button>
              <button *ngIf="auth.hasRole(['qa','admin'])"
                pButton icon="pi pi-book" label="登记结论" class="p-button-outlined" (click)="showConclusionDlg = true"></button>
              <button *ngIf="['capa_verification','root_cause_identified','completed'].includes(dev()!.status) && auth.hasRole(['qa','admin'])"
                pButton icon="pi pi-check-circle" label="关闭偏差" class="p-button-success" (click)="showCloseDlg = true"></button>
              <button *ngIf="affectedSamples().length && auth.hasRole(['qa','admin'])"
                pButton icon="pi pi-unlock" label="手动解锁样品" styleClass="p-button-warning p-button-outlined"
                (click)="doUnlockSamples()"></button>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div class="info-item"><div class="info-label">报告人</div><div class="info-value">{{ dev()!.reported_by_name || '#' + dev()!.reported_by }}</div></div>
            <div class="info-item"><div class="info-label">处理人</div><div class="info-value">{{ dev()!.handled_by_name || (dev()!.handled_by ? '#' + dev()!.handled_by : '未指派') }}</div></div>
            <div class="info-item"><div class="info-label">发现时间</div><div class="info-value text-xs">{{ dev()!.discovered_at?.slice(0,19).replace('T',' ') || '-' }}</div></div>
            <div class="info-item"><div class="info-label">截止日期</div><div class="info-value">{{ dev()!.required_date || '-' }}</div></div>
            <div class="info-item md:col-span-2"><div class="info-label">发现地点</div><div class="info-value text-left">{{ dev()!.location || '-' }}</div></div>
            <div class="info-item"><div class="info-label">关联方案</div>
              <div class="info-value text-left" *ngIf="dev()!.protocol_id">
                <a class="text-blue-600 hover:underline" [routerLink]="['/protocols', dev()!.protocol_id]">{{ dev()!.protocol_code || '#' + dev()!.protocol_id }}</a>
              </div>
              <div class="info-value" *ngIf="!dev()!.protocol_id">-</div>
            </div>
            <div class="info-item"><div class="info-label">创建时间</div><div class="info-value text-xs">{{ dev()!.created_at?.slice(0,19).replace('T',' ') || '-' }}</div></div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="font-semibold text-gray-700 text-sm block mb-2">📝 偏差描述</label>
              <div class="p-4 bg-gray-50 rounded-lg text-gray-800 whitespace-pre-line">{{ dev()!.description || '（无）' }}</div>
            </div>
            <div *ngIf="dev()!.immediate_actions">
              <label class="font-semibold text-gray-700 text-sm block mb-2">🚑 已采取应急措施</label>
              <div class="p-4 bg-blue-50 rounded-lg text-gray-800 whitespace-pre-line">{{ dev()!.immediate_actions }}</div>
            </div>
          </div>
        </div>

        <p-tabView>
          <p-tabPanel [header]="'🧪 受影响样品 (' + affectedSamples().length + ')'">
            <div class="card">
              <div class="p-3 mb-4 rounded-lg" [ngClass]="affectedSamples().length ? 'bg-red-50' : 'bg-green-50'">
                <span *ngIf="affectedSamples().length">🔒 已锁定 <b>{{ affectedSamples().length }}</b> 个样品（偏差关闭后自动解锁）</span>
                <span *ngIf="!affectedSamples().length">✅ 无受影响样品</span>
              </div>
              <p-table [value]="affectedSamples()" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr><th>样品编号</th><th>方案/条件</th><th>状态</th><th>锁定原因</th><th>操作</th></tr>
                </ng-template>
                <ng-template pTemplate="body" let-a>
                  <tr>
                    <td><a class="text-blue-600 hover:underline font-semibold" [routerLink]="['/samples', a.sample_id]">
                      {{ a.sample_code || '#' + a.sample_id }}
                    </a></td>
                    <td class="text-xs">{{ a.protocol_code || '' }} / {{ a.condition_code || '' }}</td>
                    <td><span class="badge" [ngClass]="a.is_locked ? 'badge-danger' : 'badge-success'">
                      {{ a.is_locked ? '🔒 已锁定' : '已释放' }}
                    </span></td>
                    <td class="text-xs text-gray-600">{{ a.impact_assessment || '-' }}</td>
                    <td>
                      <a [routerLink]="['/samples', a.sample_id]" pButton icon="pi pi-eye" class="p-button-text p-button-sm"></a>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage"><tr><td colspan="5" class="text-center py-8 text-gray-400">未关联样品</td></tr></ng-template>
              </p-table>
            </div>
          </p-tabPanel>

          <p-tabPanel [header]="'📚 调查结论 / CAPA (' + (dev()!.conclusions?.length || 0) + ')'">
            <div class="card">
              <div class="flex justify-end mb-4">
                <button *ngIf="auth.hasRole(['qa','admin'])"
                  pButton label="添加结论 / CAPA" icon="pi pi-plus" class="p-button-sm"
                  (click)="showConclusionDlg = true"></button>
              </div>
              @if ((dev()!.conclusions || []).length === 0) {
                <div class="text-center py-12 text-gray-400"><i class="pi pi-book text-4xl block mb-2"></i>暂无调查结论</div>
              } @else {
                <p-timeline [value]="dev()!.conclusions!" layout="vertical" align="alternate" styleClass="custom-timeline">
                  <ng-template pTemplate="content" let-c>
                    <div class="p-4 bg-white border rounded-lg shadow-sm">
                      <div class="flex justify-between items-start mb-2">
                        <span class="badge" [ngClass]="conclusionClass(c.conclusion_type)">
                          {{ conclusionLabel(c.conclusion_type) }}
                        </span>
                        <span class="text-xs text-gray-400">{{ c.created_at?.slice(0,16).replace('T',' ') }}</span>
                      </div>
                      <div class="text-sm text-gray-800 whitespace-pre-line">{{ c.conclusion_text }}</div>
                      <div class="text-xs text-gray-500 mt-2">by {{ c.created_by_name || '#' + c.created_by }}</div>
                    </div>
                  </ng-template>
                  <ng-template pTemplate="marker" let-c>
                    <span class="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full w-9 h-9 flex items-center justify-center text-sm shadow">
                      <i class="pi {{ conclusionIcon(c.conclusion_type) }}"></i>
                    </span>
                  </ng-template>
                  <ng-template pTemplate="opposite" let-c>
                    <span class="text-xs text-gray-500 font-medium">{{ c.created_at?.slice(0,10) || '' }}</span>
                  </ng-template>
                </p-timeline>
              }
            </div>
          </p-tabPanel>
        </p-tabView>
      }
    </div>
  `
})
export class DeviationDetailComponent implements OnInit {
  id = Number(this.route.snapshot.params['id']);
  loading = signal(true);
  dev = signal<any>(null);
  affectedSamples = signal<any[]>([]);
  showAssignDlg = false;
  showStatusDlg = false;
  showConclusionDlg = false;
  showCloseDlg = false;

  assignForm = new FormGroup({ handler_id: new FormControl<number | null>(null, Validators.required), remarks: new FormControl('') });
  statusForm = new FormGroup({ status: new FormControl('', Validators.required), remarks: new FormControl('', Validators.required) });
  conclusionForm = new FormGroup({ conclusion_type: new FormControl('corrective', Validators.required), conclusion_text: new FormControl('', Validators.required) });
  closeForm = new FormGroup({ final_conclusion: new FormControl('', Validators.required), effectiveness_check: new FormControl('', Validators.required), conclusion_date: new FormControl<string>(this.today()) });
  qaOptions: any[] = [];

  statusFlow = [
    { label: '1️⃣ 已报告', value: 'reported' },
    { label: '2️⃣ 调查中', value: 'under_investigation' },
    { label: '3️⃣ 已定位根本原因', value: 'root_cause_identified' },
    { label: '4️⃣ 已实施 CAPA', value: 'capa_implemented' },
    { label: '5️⃣ CAPA 验证', value: 'capa_verification' },
    { label: '6️⃣ 已完成', value: 'completed' },
    { label: '❌ 已取消', value: 'cancelled' },
  ];

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private svc: DeviationService,
    private message: MessageService,
    private confirm: ConfirmationService,
  ) {
    this.assignForm.valueChanges.subscribe(() => {});
  }

  ngOnInit(): void {
    this.load();
    this.qaOptions = [
      { id: this.auth.currentUser?.id || 1, label: this.auth.currentUser?.full_name + ' (我)' },
      { id: 0, label: 'admin (QA)' }, { id: 0, label: 'qa1 (QA)' }
    ];
  }

  today(): string {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  load() {
    this.loading.set(true);
    this.svc.get(this.id).subscribe({
      next: (d) => { this.dev.set(d); this.loading.set(false);
        this.affectedSamples.set(d.affected_samples || []); },
      error: () => this.loading.set(false)
    });
  }

  severityClass(s: DeviationSeverity): string {
    return { minor: 'badge-info', major: 'badge-warning', critical: 'badge-danger' }[s] || 'badge';
  }
  severityLabel(s: DeviationSeverity): string {
    return { minor: '🟢 轻微', major: '🟠 主要', critical: '🔴 严重' }[s] || s;
  }
  categoryLabel(c: DeviationCategory): string {
    return {
      environment_temperature_humidity: '🌡️ 温湿度偏差', out_of_specification: '🧪 OOS结果',
      sampling_window_violation: '⏰ 取样超窗', equipment: '⚙️ 设备异常',
      material: '📦 物料异常', process: '🏭 工艺异常', documentation: '📋 文件记录',
      personnel: '👥 人员操作', laboratory: '🔬 实验室', other: '其他'
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
      reported: '📝 已报告', under_investigation: '🔍 调查中', root_cause_identified: '🎯 已定位原因',
      capa_implemented: '🛠️ CAPA已实施', capa_verification: '✅ CAPA验证',
      closed: '✅ 已关闭', completed: '✅ 已完成', cancelled: '❌ 已取消'
    }[s] || s;
  }

  conclusionClass(t: string): string {
    return { root_cause: 'badge-warning', corrective: 'badge-info', preventive: 'badge-secondary', risk: 'badge-danger', verification: 'badge-primary', final: 'badge-success' }[t] || 'badge';
  }
  conclusionLabel(t: string): string {
    return { root_cause: '🎯 根本原因', corrective: '🛠️ 纠正', preventive: '🛡️ 预防', risk: '⚠️ 风险', verification: '✅ 验证', final: '📌 最终' }[t] || t;
  }
  conclusionIcon(t: string): string {
    return { root_cause: 'pi-bullseye', corrective: 'pi-wrench', preventive: 'pi-shield', risk: 'pi-exclamation-triangle', verification: 'pi-check', final: 'pi-flag' }[t] || 'pi-book';
  }

  openAssign() {
    this.assignForm.reset({ handler_id: this.auth.currentUser?.id || null, remarks: '' });
    this.showAssignDlg = true;
  }
  doAssign() {
    if (this.assignForm.invalid) return;
    const v: any = this.assignForm.value;
    this.svc.assign(this.id, { handled_by: v.handler_id, remarks: v.remarks }).subscribe({
      next: (d) => { this.dev.set(d); this.showAssignDlg = false;
        this.message.add({ severity: 'success', summary: '已指派处理人' }); },
      error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }

  openStatus() {
    this.statusForm.reset({ status: this.dev()?.status || 'under_investigation', remarks: '' });
    this.showStatusDlg = true;
  }
  doStatus() {
    if (this.statusForm.invalid) return;
    const v: any = this.statusForm.value;
    this.svc.updateStatus(this.id, { status: v.status as DeviationStatus, remarks: v.remarks }).subscribe({
      next: (d) => { this.dev.set(d); this.showStatusDlg = false;
        this.message.add({ severity: 'success', summary: '状态已更新' }); },
      error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }

  doConclusion() {
    if (this.conclusionForm.invalid) return;
    const v: any = this.conclusionForm.value;
    this.svc.addConclusion(this.id, v).subscribe({
      next: () => { this.conclusionForm.reset(); this.showConclusionDlg = false;
        this.message.add({ severity: 'success', summary: '已添加调查结论' }); this.load(); },
      error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }

  doClose() {
    if (this.closeForm.invalid) return;
    const v: any = this.closeForm.value;
    this.svc.close(this.id, v).subscribe({
      next: (d) => { this.dev.set(d); this.showCloseDlg = false;
        this.message.add({ severity: 'success', summary: '偏差已关闭', detail: '样品已同步解锁' }); this.load(); },
      error: (e) => this.message.add({ severity: 'error', summary: '关闭失败', detail: e.error?.detail })
    });
  }

  doUnlockSamples() {
    this.confirm.confirm({
      key: 'confirm', header: '确认解锁样品',
      message: `手动解锁本偏差关联的全部 ${this.affectedSamples().length} 个样品？（偏差仍将保持当前状态）`,
      accept: () => this.svc.unlockSamples(this.id).subscribe({
        next: (d) => { this.dev.set(d); this.message.add({ severity:'success', summary:'样品已解锁' }); this.load(); },
        error: e => this.message.add({ severity:'error', detail: e.error?.detail })
      })
    });
  }
}
