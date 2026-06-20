import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabViewModule } from 'primeng/tabview';
import { TimelineModule } from 'primeng/timeline';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SampleService } from '../../../shared/services/sample.service';
import { TestResultService } from '../../../shared/services/test-result.service';
import { DeviationService } from '../../../shared/services/deviation.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Sample, SampleStatus } from '../../../shared/models';

@Component({
  selector: 'app-sample-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TableModule, TagModule, TabViewModule,
    TimelineModule, TooltipModule, ConfirmDialogModule, DialogModule, InputTextareaModule, ToastModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog key="confirm"></p-confirmDialog>
    <p-dialog header="解锁样品" [(visible)]="showUnlockDlg" [modal]="true" [style]="{ width: '420px' }">
      <textarea pInputTextarea [(ngModel)]="unlockReason" [rows]="3" class="w-full" placeholder="请输入解锁原因"></textarea>
      <div class="flex justify-end gap-2 mt-4">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showUnlockDlg = false"></button>
        <button pButton label="确认解锁" styleClass="p-button-warning" [disabled]="!unlockReason" (click)="doUnlock()"></button>
      </div>
    </p-dialog>

    <div class="space-y-6">
      @if (loading()) {
        <div class="text-center py-20"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
      } @else if (!sample()) {
        <div class="card text-center py-16 text-gray-500">样品不存在</div>
      } @else {
        <div class="card">
          <div class="flex justify-between items-start flex-wrap gap-4">
            <div class="flex items-start gap-3 flex-wrap">
              <a routerLink="/samples" pButton icon="pi pi-arrow-left" class="p-button-text p-button-plain"></a>
              <div>
                <div class="flex items-center gap-3">
                  <h2 class="text-2xl font-bold text-gray-800 m-0">{{ sample()!.sample_code }}</h2>
                  <span class="badge text-base px-3 py-1" [ngClass]="statusClass(sample()!.status)">{{ statusLabel(sample()!.status) }}</span>
                  <span *ngIf="sample()!.is_locked" class="badge badge-danger px-3 py-1 text-base">🔒 {{ sample()!.lock_reason || '已锁定' }}</span>
                </div>
                <div class="mt-1 text-gray-600">
                  方案：<a class="text-blue-600 hover:underline" [routerLink]="['/protocols', sample()!.protocol_id]">
                    {{ sample()!.protocol_code || '#' + sample()!.protocol_id }}
                  </a> · 产品：{{ sample()!.product_name }} · 批次：{{ sample()!.batch_number }}
                </div>
              </div>
            </div>

            <div class="flex gap-2 flex-wrap">
              <button *ngIf="sample()!.status === 'in_storage' && !sample()!.is_locked"
                pButton label="取样检测" icon="pi pi-sign-out"
                [routerLink]="['/samples', id, 'sampling']"></button>
              <button *ngIf="sample()!.is_locked && auth.hasRole(['qa','admin'])"
                pButton label="解锁样品" icon="pi pi-unlock" styleClass="p-button-warning"
                (click)="showUnlockDlg = true"></button>
              <button *ngIf="!sample()!.is_locked && auth.hasRole(['qa','admin'])"
                pButton label="锁定样品" icon="pi pi-lock" styleClass="p-button-danger p-button-outlined"
                (click)="quickLock()"></button>
            </div>
          </div>

          <div class="grid-4 mt-6 gap-3">
            <div class="info-item"><div class="info-label">样品编号</div><div class="info-value">{{ sample()!.sample_code }}</div></div>
            <div class="info-item"><div class="info-label">储存条件</div><div class="info-value">{{ sample()!.condition_code || '#' + sample()!.condition_id }}</div></div>
            <div class="info-item"><div class="info-label">位置/温箱</div><div class="info-value">{{ sample()!.chamber_position || sample()!.location || '-' }}</div></div>
            <div class="info-item"><div class="info-label">数量</div><div class="info-value">{{ sample()!.quantity }} {{ sample()!.unit || '单位' }}</div></div>
            <div class="info-item"><div class="info-label">入箱时间</div><div class="info-value">{{ sample()!.in_chamber_at?.slice(0,19).replace('T',' ') || '-' }}</div></div>
            <div class="info-item"><div class="info-label">最后出箱</div><div class="info-value">{{ sample()!.out_chamber_at?.slice(0,19).replace('T',' ') || '-' }}</div></div>
            <div class="info-item"><div class="info-label">取样次数</div><div class="info-value">{{ sample()!.sampling_count || 0 }}</div></div>
            <div class="info-item"><div class="info-label">关联偏差</div><div class="info-value">{{ deviations().length }}</div></div>
          </div>
        </div>

        <p-tabView>
          <p-tabPanel header="📊 取样记录">
            <div class="card">
              <p-table [value]="samplingRecords()" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr>
                    <th>时间点</th><th>取样时间</th><th>取样量</th><th>在窗口内</th>
                    <th>出箱/归位时长</th><th>备注</th><th>操作</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-sr>
                  <tr>
                    <td><b>{{ sr.timepoint_label || '#' + sr.timepoint_id }}</b></td>
                    <td>{{ sr.sampled_at?.slice(0,19).replace('T',' ') }}</td>
                    <td>{{ sr.sampled_quantity }}</td>
                    <td>
                      <span class="badge" [ngClass]="sr.is_within_window ? 'badge-success' : 'badge-danger'">
                        {{ sr.is_within_window ? '✅ 合规' : '❌ 超窗' }}
                      </span>
                      <span *ngIf="sr.window_deviation_note" class="text-xs text-gray-500 block">{{ sr.window_deviation_note }}</span>
                    </td>
                    <td>{{ sr.total_exposure_minutes ? sr.total_exposure_minutes + '分钟' : '-' }}</td>
                    <td class="text-xs">{{ sr.remarks || '-' }}</td>
                    <td><button *ngIf="!sr.has_test_result" pButton label="录入结果" icon="pi pi-file-plus" class="p-button-sm p-button-outlined"
                      [routerLink]="['/test-results/new']" [queryParams]="{sample: sample()!.id, sr: sr.id}" class="p-button-sm"></button></td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="7"><div class="empty-state"><i class="pi pi-calendar"></i><h3>暂无取样记录</h3></div></td></tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabPanel>

          <p-tabPanel [header]="'🧪 检测结果 (' + testResults().length + ')'">
            <div class="card">
              <div class="flex justify-end mb-3">
                <button *ngIf="auth.hasRole(['researcher','qa','admin'])"
                  pButton label="录入检测结果" icon="pi pi-plus" class="p-button-sm"
                  [routerLink]="['/test-results/new']" [queryParams]="{sample: id}"></button>
              </div>
              <p-table [value]="testResults()" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr><th>结果编号</th><th>分析员</th><th>检测日期</th><th>状态</th><th>质量</th><th>操作</th></tr>
                </ng-template>
                <ng-template pTemplate="body" let-r>
                  <tr>
                    <td><a [routerLink]="['/test-results', r.id]"><b>{{ r.result_code }}</b></a></td>
                    <td>{{ r.analyst || '-' }}</td><td>{{ r.testing_date }}</td>
                    <td><span class="badge" [ngClass]="resultStatusClass(r.status)">{{ resultStatusLabel(r.status) }}</span></td>
                    <td><span class="badge" [ngClass]="r.is_oos?'badge-danger':r.is_oot?'badge-warning':'badge-success'">
                      {{ r.is_oos ? '❌ OOS' : r.is_oot ? '⚠️ OOT' : '✅ 合格' }}</span></td>
                    <td><a [routerLink]="['/test-results', r.id]" pButton label="查看" class="p-button-sm p-button-text"></a></td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="6"><div class="empty-state text-center py-8 text-gray-400">
                    <i class="pi pi-list-check text-3xl block mb-2"></i>暂无检测结果</div></td></tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabPanel>

          <p-tabPanel [header]="'🕐 流转轨迹 (' + movements().length + ')'">
            <div class="card">
              <p-timeline [value]="movements()" layout="vertical" align="alternate">
                <ng-template pTemplate="content" let-m>
                  <div class="p-3 bg-white border rounded-lg shadow-sm" style="max-width: 400px;">
                    <div class="flex justify-between items-start mb-1">
                      <span class="badge" [ngClass]="movementClass(m.movement_type)">{{ m.movement_type }}</span>
                      <span class="text-xs text-gray-400">{{ m.operated_at?.slice(0,19).replace('T',' ') }}</span>
                    </div>
                    <div class="text-sm text-gray-700 mb-1">
                      <b>{{ m.operator_name || ('用户#' + m.operated_by) }}</b> 执行
                    </div>
                    <div *ngIf="m.location || m.chamber_position" class="text-xs text-gray-500 mb-1">
                      位置：{{ m.location || '-' }} {{ m.chamber_position ? ' · ' + m.chamber_position : '' }}
                    </div>
                    <div *ngIf="m.remarks" class="text-xs text-gray-600 italic">{{ m.remarks }}</div>
                  </div>
                </ng-template>
                <ng-template pTemplate="marker" let-m>
                  <span class="bg-white border-2 rounded-full w-8 h-8 flex items-center justify-center text-sm shadow"
                    [ngClass]="{
                      'border-green-500 text-green-600': m.movement_type === 'IN_CHAMBER',
                      'border-blue-500 text-blue-600': m.movement_type === 'OUT_CHAMBER' || m.movement_type === 'RETURN',
                      'border-purple-500 text-purple-600': m.movement_type === 'SAMPLING',
                      'border-red-500 text-red-600': m.movement_type === 'LOCK',
                      'border-yellow-500 text-yellow-600': m.movement_type === 'UNLOCK',
                      'border-gray-500 text-gray-600': m.movement_type === 'DESTROY'
                    }">
                    <i class="pi {{ m.movement_type === 'IN_CHAMBER' ? 'pi-sign-in' :
                      m.movement_type === 'OUT_CHAMBER' || m.movement_type === 'RETURN' ? 'pi-sign-out' :
                      m.movement_type === 'SAMPLING' ? 'pi-flask' :
                      m.movement_type === 'LOCK' ? 'pi-lock' :
                      m.movement_type === 'UNLOCK' ? 'pi-unlock' :
                      m.movement_type === 'DESTROY' ? 'pi-trash' : 'pi-circle' }}"></i>
                  </span>
                </ng-template>
                <ng-template pTemplate="opposite" let-m>{{ m.operated_at?.slice(0,10) || '' }}</ng-template>
              </p-timeline>
            </div>
          </p-tabPanel>

          <p-tabPanel [header]="'🚨 关联偏差 (' + deviations().length + ')'">
            <div class="card">
              <p-table [value]="deviations()" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr><th>偏差编号</th><th>标题</th><th>类型</th><th>严重度</th><th>状态</th><th>操作</th></tr>
                </ng-template>
                <ng-template pTemplate="body" let-d>
                  <tr>
                    <td><b>{{ d.deviation_code || '#' + d.id }}</b></td>
                    <td>{{ d.title }}</td>
                    <td>{{ d.category }}</td>
                    <td><span class="badge" [ngClass]="d.severity==='critical'?'badge-danger':d.severity==='major'?'badge-warning':'badge-info'">
                      {{ d.severity==='critical'?'严重':d.severity==='major'?'主要':'次要' }}</span></td>
                    <td><span class="badge badge-secondary">{{ d.status }}</span></td>
                    <td><a [routerLink]="['/deviations', d.id]" pButton label="查看" class="p-button-sm p-button-text"></a></td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="6" class="text-center py-6 text-gray-400">该样品暂无关联偏差记录</td></tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabPanel>
        </p-tabView>
      }
    </div>
  `
})
export class SampleDetailComponent implements OnInit {
  id = Number(this.route.snapshot.params['id']);
  sample = signal<Sample | null>(null);
  movements = signal<any[]>([]);
  samplingRecords = signal<any[]>([]);
  testResults = signal<any[]>([]);
  deviations = signal<any[]>([]);
  loading = signal(true);
  unlockReason = '';
  showUnlockDlg = false;

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private sampleSvc: SampleService,
    private resultSvc: TestResultService,
    private deviationSvc: DeviationService,
    private message: MessageService,
    private confirm: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.sampleSvc.get(this.id).subscribe({
      next: (s) => {
        this.sample.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.sampleSvc.getSamplingRecordsBySample(this.id).subscribe(list => this.samplingRecords.set(list));
    this.resultSvc.list({ sample_id: this.id, limit: 100 }).subscribe(list => this.testResults.set(list));
  }

  statusClass(s: SampleStatus): string {
    return {
      generated: 'badge-secondary', in_storage: 'badge-success', out_for_sampling: 'badge-info',
      sampled: 'badge-primary', returned: 'badge-info', destroyed: 'badge-dark',
      quarantine: 'badge-warning'
    }[s] || 'badge';
  }
  statusLabel(s: SampleStatus): string {
    return { generated: '已生成', in_storage: '在储存', out_for_sampling: '取样中',
      sampled: '已取样', returned: '已归还', destroyed: '已销毁', quarantine: '隔离' }[s] || s;
  }

  movementClass(t: string): string {
    return {
      IN_CHAMBER: 'badge-success', OUT_CHAMBER: 'badge-info', SAMPLING: 'badge-primary',
      RETURN: 'badge-info', LOCK: 'badge-danger', UNLOCK: 'badge-warning', DESTROY: 'badge-dark'
    }[t] || 'badge';
  }

  resultStatusClass(s: string): string {
    return { draft:'badge-secondary', submitted:'badge-info', approved:'badge-success', rejected:'badge-danger', under_review:'badge-warning' }[s] || 'badge';
  }
  resultStatusLabel(s: string): string {
    return { draft:'草稿', submitted:'待审批', approved:'已批准', rejected:'已驳回', under_review:'审核中' }[s] || s;
  }

  quickLock() {
    this.confirm.confirm({
      key: 'confirm', header: '锁定样品', message: '确认锁定该样品？锁定后无法取样/出箱。',
      accept: () => {
        this.sampleSvc.lock(this.id, { lock_reason: 'QA手工锁定' }).subscribe({
          next: (s) => { this.sample.set(s); this.message.add({ severity:'success', summary:'已锁定' }); }
        });
      }
    });
  }

  doUnlock() {
    this.sampleSvc.unlock(this.id, { unlock_reason: this.unlockReason }).subscribe({
      next: (s) => { this.sample.set(s); this.showUnlockDlg = false; this.unlockReason = '';
        this.message.add({ severity:'success', summary:'已解锁' }); }
    });
  }
}
