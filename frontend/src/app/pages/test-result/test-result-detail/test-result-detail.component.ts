import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { TestResultService } from '../../../shared/services/test-result.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ResultStatus } from '../../../shared/models';

@Component({
  selector: 'app-test-result-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, TableModule, TagModule,
    DialogModule, InputTextareaModule, ToastModule, TabViewModule, TooltipModule, DividerModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    <p-dialog header="QA 审批操作" [(visible)]="showReviewDlg" [modal]="true" [style]="{ width: '460px' }">
      <div class="space-y-4">
        <div class="p-3 rounded-lg" [ngClass]="reviewType === 'approve' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
          <div class="font-semibold" [ngClass]="reviewType === 'approve' ? 'text-green-700' : 'text-red-700'">
            {{ reviewType === 'approve' ? '✅ 批准该检测结果（电子签名）' : '❌ 驳回该检测结果' }}
          </div>
          <div class="text-xs mt-1" [ngClass]="reviewType === 'approve' ? 'text-green-600' : 'text-red-600'">
            操作人：{{ auth.currentUser?.full_name }} · {{ auth.currentUser?.username }}<br>
            批准后结果状态变为【已批准】，任何角色都无法再修改
          </div>
        </div>
        <form [formGroup]="reviewForm">
          <div>
            <label class="field-label">{{ reviewType === 'approve' ? '批准评语' : '驳回原因' }} <span class="text-red-500">*</span></label>
            <textarea pInputTextarea formControlName="comments" [rows]="4" class="w-full"
              [placeholder]="reviewType === 'approve' ? '如：数据完整，检测方法合规，予以批准。' : '请详细说明驳回原因'"></textarea>
          </div>
        </form>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showReviewDlg = false"></button>
        <button pButton [label]="reviewType === 'approve' ? '电子签名批准' : '提交驳回'"
          [styleClass]="reviewType === 'approve' ? 'p-button-success' : 'p-button-danger'"
          [disabled]="!reviewForm.valid || submitting()"
          [loading]="submitting()"
          (click)="doReview()">
        </button>
      </div>
    </p-dialog>

    <div class="space-y-6">
      @if (loading()) {
        <div class="text-center py-20"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
      } @else if (!result()) {
        <div class="card text-center py-16 text-gray-500">检测结果不存在</div>
      } @else {
        <div class="card" [style]="{
          border: result()!.is_oos ? '2px solid #fee2e2' : result()!.is_oot ? '2px solid #fef3c7' : '',
          boxShadow: result()!.status === 'approved' ? 'inset 0 0 0 2px #86efac' : ''
        }">
          <div class="flex justify-between flex-wrap gap-3 mb-5">
            <div class="flex items-center gap-3 flex-wrap">
              <a routerLink="/test-results" pButton icon="pi pi-arrow-left" class="p-button-text p-button-plain"></a>
              <div>
                <div class="flex items-center gap-3 flex-wrap mb-1">
                  <h2 class="text-2xl font-bold text-gray-800 m-0">{{ result()!.result_code }}</h2>
                  <span class="badge text-base px-3 py-1" [ngClass]="statusClass(result()!.status)">
                    {{ statusLabel(result()!.status) }}
                  </span>
                  <span *ngIf="result()!.is_oos" class="badge badge-danger px-3 py-1 text-base">❌ OOS</span>
                  <span *ngIf="!result()!.is_oos && result()!.is_oot" class="badge badge-warning px-3 py-1 text-base">⚠️ OOT</span>
                  <span *ngIf="result()!.status === 'approved'" class="badge badge-success px-3 py-1 text-base">
                    🔒 已锁定（审批后不可修改）
                  </span>
                </div>
                <div class="text-sm text-gray-600">
                  样品：<a class="text-blue-600 hover:underline" [routerLink]="['/samples', result()!.sample_id]">
                    {{ result()!.sample_code || '#' + result()!.sample_id }}
                  </a>
                  · 方案：<a class="text-blue-600 hover:underline" [routerLink]="['/protocols', result()!.protocol_id || 0]" *ngIf="result()!.protocol_id">
                    {{ result()!.protocol_code || '#' + result()!.protocol_id }}
                  </a>
                </div>
              </div>
            </div>

            <div class="flex gap-2 flex-wrap">
              <button *ngIf="canEdit()"
                [routerLink]="['/test-results/new']" [queryParams]="{ edit: id }"
                pButton label="编辑" icon="pi pi-pencil" class="p-button-outlined"></button>
              <button *ngIf="result()!.status === 'draft' && canEdit()"
                pButton label="提交审批" icon="pi pi-check-circle"
                (click)="doSubmit()" class="p-button-help"></button>
              <button *ngIf="result()!.status === 'submitted' && auth.hasRole(['qa','admin'])"
                pButton label="批准" icon="pi pi-check" class="p-button-success"
                (click)="openReview('approve')"></button>
              <button *ngIf="result()!.status === 'submitted' && auth.hasRole(['qa','admin'])"
                pButton label="驳回" icon="pi pi-times" class="p-button-danger p-button-outlined"
                (click)="openReview('reject')"></button>
              <a *ngIf="result()!.is_oos && auth.hasRole(['qa','admin'])"
                [routerLink]="['/deviations/new']"
                [queryParams]="{ tr: id, code: result()!.result_code }"
                pButton label="启动 OOS 调查" icon="pi pi-search" class="p-button-warning"></a>
            </div>
          </div>

          @if (result()!.status === 'approved') {
            <div class="p-4 mb-4 rounded-lg bg-green-50 border border-green-200">
              <div class="flex items-start gap-3">
                <span class="text-3xl">✅</span>
                <div class="flex-1">
                  <div class="font-semibold text-green-800">该检测结果已被 QA 批准（电子签名 + 状态锁定）</div>
                  <div class="text-sm text-green-700 mt-1">
                    <b>批准人：</b>{{ result()!.approved_by_name || '用户#' + result()!.approved_by }} · 
                    <b>批准时间：</b>{{ result()!.approved_at?.slice(0,19).replace('T',' ') }}<br>
                    <b>评语：</b>{{ result()!.approved_comments || '无' }}
                  </div>
                </div>
                <span class="text-5xl text-green-300 opacity-30 font-bold">APPROVED</span>
              </div>
            </div>
          }

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div class="info-item"><div class="info-label">检测日期</div><div class="info-value">{{ result()!.testing_date }}</div></div>
            <div class="info-item"><div class="info-label">分析员</div><div class="info-value">{{ result()!.analyst || '-' }}</div></div>
            <div class="info-item"><div class="info-label">检测方法</div><div class="info-value">{{ result()!.method_name || '-' }}</div></div>
            <div class="info-item"><div class="info-label">仪器</div><div class="info-value">{{ result()!.instrument || '-' }}</div></div>
            <div class="info-item md:col-span-2"><div class="info-label">总体结论</div>
              <div class="info-value text-left">{{ result()!.summary || '（无）' }}</div>
            </div>
            <div class="info-item"><div class="info-label">创建人</div>
              <div class="info-value">{{ result()!.created_by_name || '#' + result()!.created_by }}</div>
            </div>
            <div class="info-item"><div class="info-label">更新时间</div>
              <div class="info-value text-left text-sm">{{ result()!.updated_at?.slice(0,19).replace('T',' ') || '-' }}</div>
            </div>
          </div>
        </div>

        <p-tabView>
          <p-tabPanel [header]="'🧪 检测项目明细 (' + (result()!.items?.length || 0) + ')'">
            <div class="card">
              <p-table [value]="result()!.items || []" responsiveLayout="scroll" size="small">
                <ng-template pTemplate="header">
                  <tr>
                    <th style="width:40px;">#</th>
                    <th>检测项目</th>
                    <th>质量标准/规格</th>
                    <th>结果值</th>
                    <th>单位</th>
                    <th>详细描述</th>
                    <th>质量判定</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-it let-ri="rowIndex">
                  <tr [style]="{ background: it.is_oos ? '#fef2f2' : it.is_oot ? '#fffbeb' : '' }">
                    <td>{{ ri + 1 }}</td>
                    <td><b>{{ it.test_name }}</b></td>
                    <td class="text-blue-700 font-medium">{{ it.specification }}</td>
                    <td class="font-semibold" [style]="{ color: it.is_oos ? '#dc2626' : it.is_oot ? '#d97706' : '#16a34a' }">
                      {{ it.result_value }}
                    </td>
                    <td>{{ it.unit || '-' }}</td>
                    <td class="text-xs text-gray-600 max-w-xs">{{ it.result_text || '-' }}</td>
                    <td>
                      <span class="badge" [ngClass]="it.is_oos?'badge-danger':it.is_oot?'badge-warning':'badge-success'">
                        {{ it.is_oos ? '❌ OOS' : it.is_oot ? '⚠️ OOT' : '✅ 合格' }}
                      </span>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr><td colspan="7" class="text-center py-8 text-gray-400">暂无检测项目明细</td></tr>
                </ng-template>
              </p-table>
            </div>
          </p-tabPanel>

          <p-tabPanel header="📝 审批历史 / 电子签名">
            <div class="card">
              @if ((result()!.approvals || []).length === 0) {
                <div class="text-center py-8 text-gray-400">暂无审批记录</div>
              } @else {
                <div class="space-y-3">
                  @for (ap of result()!.approvals || []; track ap.id) {
                    <div class="p-4 border rounded-lg"
                      [ngClass]="ap.approved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'">
                      <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-2">
                          <span class="text-xl">{{ ap.approved ? '✅' : '❌' }}</span>
                          <b class="text-gray-800">{{ ap.approved ? '批准' : '驳回' }}</b>
                          <span class="text-xs text-gray-500">
                            {{ ap.approved_by_name || '用户#' + ap.approved_by }}
                            · {{ ap.approved_at?.slice(0,19).replace('T',' ') }}
                          </span>
                        </div>
                        <span class="text-xs text-gray-400 font-mono">#{{ ap.id }}</span>
                      </div>
                      <div class="text-sm text-gray-700 pl-8">{{ ap.comments || '（无评语）' }}</div>
                    </div>
                  }
                </div>
              }
            </div>
          </p-tabPanel>
        </p-tabView>
      }
    </div>
  `
})
export class TestResultDetailComponent implements OnInit {
  id = Number(this.route.snapshot.params['id']);
  loading = signal(true);
  result = signal<any>(null);
  submitting = signal(false);
  showReviewDlg = false;
  reviewType: 'approve' | 'reject' = 'approve';
  reviewForm = new FormGroup({ comments: new FormControl('', Validators.required) });

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private svc: TestResultService,
    private message: MessageService,
  ) {}

  ngOnInit(): void { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.get(this.id).subscribe({
      next: async (r: any) => {
        r.approvals = await new Promise<any[]>(resolve => {
          this.svc.getApprovals(this.id).subscribe({ next: resolve, error: () => resolve([]) });
        });
        this.result.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  statusClass(s: ResultStatus): string {
    return { draft: 'badge-secondary', submitted: 'badge-info', approved: 'badge-success',
      rejected: 'badge-danger', under_review: 'badge-warning' }[s] || 'badge';
  }
  statusLabel(s: ResultStatus): string {
    return { draft: '草稿', submitted: '待审批', approved: '已批准', rejected: '已驳回', under_review: '审核中' }[s] || s;
  }

  canEdit(): boolean {
    const r = this.result();
    if (!r) return false;
    if (r.status === 'approved') return false; // 批准后永远不可修改
    if (r.status === 'draft') return r.created_by === this.auth.currentUser?.id || this.auth.hasRole(['qa','admin']);
    if (r.status === 'rejected') return r.created_by === this.auth.currentUser?.id || this.auth.hasRole(['qa','admin']);
    return this.auth.hasRole(['qa', 'admin']);
  }

  doSubmit() {
    this.submitting.set(true);
    this.svc.submit(this.id, '提交审批').subscribe({
      next: (r: any) => { this.result.set(r); this.submitting.set(false);
        this.message.add({ severity: 'success', summary: '已提交审批' }); },
      error: e => { this.submitting.set(false);
        this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail }); }
    });
  }

  openReview(type: 'approve' | 'reject') {
    this.reviewType = type;
    this.reviewForm.reset({ comments: '' });
    this.showReviewDlg = true;
  }

  doReview() {
    if (!this.reviewForm.valid) return;
    this.submitting.set(true);
    this.svc.review(this.id, {
      approved: this.reviewType === 'approve',
      comments: this.reviewForm.value.comments || ''
    }).subscribe({
      next: (r: any) => {
        this.result.set(r); this.showReviewDlg = false; this.submitting.set(false);
        this.message.add({
          severity: 'success',
          summary: this.reviewType === 'approve' ? '已批准（结果已锁定）' : '已驳回'
        });
        this.load();
      },
      error: e => { this.submitting.set(false);
        this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail }); }
    });
  }
}
