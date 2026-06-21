import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule, FormArray, Validators, FormBuilder } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { FieldsetModule } from 'primeng/fieldset';
import { MessageService } from 'primeng/api';
import { TestResultService } from '../../../shared/services/test-result.service';
import { SampleService } from '../../../shared/services/sample.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ResultStatus } from '../../../shared/models';

@Component({
  selector: 'app-test-result-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule, ButtonModule, CardModule, TableModule, TagModule,
    DialogModule, DropdownModule, InputTextModule, InputTextareaModule, InputNumberModule, CalendarModule,
    ToastModule, FieldsetModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <div class="card">
        <div class="page-header flex-wrap">
          <div>
            <h2 class="page-title">检测结果与审批</h2>
            <p class="page-subtitle">检测结果录入、OOS/OOT自动判定、电子签名审批</p>
          </div>
          <div class="flex gap-2">
            <button *ngIf="auth.hasRole(['researcher','qa','admin'])"
              pButton label="录入检测结果" icon="pi pi-plus"
              style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;"
              routerLink="/test-results/new"></button>
          </div>
        </div>

        <div class="grid-5 gap-3 mt-6 mb-5">
          <div class="stat-mini"><div class="text-xs text-gray-500">结果总数</div><div class="text-2xl font-bold">{{ total() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">草稿</div><div class="text-2xl font-bold text-gray-600">{{ draft() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">待审批</div><div class="text-2xl font-bold text-blue-600">{{ pending() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">已批准</div><div class="text-2xl font-bold text-green-600">{{ approved() }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">OOS</div><div class="text-2xl font-bold text-red-600">{{ oos() }}</div></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label class="field-label">样品</label>
            <input pInputText [(ngModel)]="filter.kw" placeholder="搜索结果/样品/编号" class="w-full" (ngModelChange)="applyFilter()">
          </div>
          <div>
            <label class="field-label">状态</label>
            <p-dropdown [(ngModel)]="filter.status" [options]="[
              {label:'全部',value:''},{label:'草稿',value:'draft'},
              {label:'待审批',value:'submitted'},{label:'审核中',value:'under_review'},
              {label:'已批准',value:'approved'},{label:'已驳回',value:'rejected'}]"
              optionLabel="label" optionValue="value" (ngModelChange)="applyFilter()" styleClass="w-full" [showClear]="true"></p-dropdown>
          </div>
          <div>
            <label class="field-label">质量</label>
            <p-dropdown [(ngModel)]="filter.quality" [options]="[
              {label:'全部',value:''},{label:'合格',value:'ok'},{label:'OOS',value:'oos'},{label:'OOT',value:'oot'}]"
              optionLabel="label" optionValue="value" (ngModelChange)="applyFilter()" styleClass="w-full" [showClear]="true"></p-dropdown>
          </div>
          <div class="flex items-end gap-2">
            <button pButton icon="pi pi-refresh" label="刷新" (click)="load()"></button>
          </div>
        </div>
      </div>

      <div class="card">
        @if (loading()) {
          <div class="text-center py-16"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
        } @else {
          <p-table [value]="filtered()" [paginator]="true" [rows]="15" [rowsPerPageOptions]="[15, 30, 60]" size="small" responsiveLayout="scroll" [tableStyle]="{'min-width':'85rem'}">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:140px;">结果编号</th>
                <th>样品</th>
                <th style="width:100px;">分析员</th>
                <th style="width:110px;">检测日期</th>
                <th>方法/仪器</th>
                <th style="width:100px;">状态</th>
                <th style="width:100px;">质量判定</th>
                <th style="width:100px;">批准人</th>
                <th style="width:130px;" class="text-center">操作</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-r>
              <tr [style]="{ background: r.is_oos ? '#fef2f2' : r.is_oot ? '#fffbeb' : '' }">
                <td><a [routerLink]="['/test-results', r.id]"><b>{{ r.result_code }}</b></a></td>
                <td>
                  <div class="text-sm font-medium">{{ r.sample_code || '#' + r.sample_id }}</div>
                  <div class="text-xs text-gray-500">{{ r.product_name || '' }} {{ r.timepoint_label || '' }}</div>
                </td>
                <td>{{ r.analyst || '-' }}</td>
                <td>{{ r.testing_date }}</td>
                <td class="text-xs text-gray-600">{{ r.testing_method || '' }} / {{ r.instrument_no || '' }}</td>
                <td>
                  <span class="badge" [ngClass]="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
                </td>
                <td>
                  <span class="badge" [ngClass]="r.is_oos ? 'badge-danger' : r.is_oot ? 'badge-warning' : 'badge-success'">
                    {{ r.is_oos ? 'OOS' : r.is_oot ? 'OOT' : '合格' }}
                  </span>
                </td>
                <td class="text-xs">{{ r.approved_by_name || (r.status === 'approved' ? '已批准' : '-') }}</td>
                <td class="text-center">
                  <a [routerLink]="['/test-results', r.id]" pButton icon="pi pi-eye" class="p-button-text p-button-sm" pTooltip="详情"></a>
                  <button *ngIf="r.status === 'submitted' && auth.hasRole(['qa','admin'])"
                    pButton icon="pi pi-check" class="p-button-text p-button-sm p-button-success" (click)="quickApprove(r)"></button>
                  <button *ngIf="r.status === 'draft' && (r.created_by === auth.currentUser?.id || auth.hasRole(['qa','admin']))"
                    [routerLink]="['/test-results/new']" [queryParams]="{edit: r.id}"
                    pButton icon="pi pi-pencil" class="p-button-text p-button-sm"></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="9">
                <div class="empty-state">
                  <i class="pi pi-list-check"></i>
                  <h3>暂无检测结果</h3>
                  <p>从录入检测结果开始创建</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>
  `
})
export class TestResultListComponent implements OnInit {
  loading = signal(true);
  all = signal<any[]>([]);
  filtered = signal<any[]>([]);
  total = signal(0); draft = signal(0); pending = signal(0); approved = signal(0); oos = signal(0);

  filter: any = { kw: '', status: '', quality: '' };

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private svc: TestResultService,
    private sample: SampleService,
    private fb: FormBuilder,
    private message: MessageService,
  ) { }

  ngOnInit(): void { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.list({ limit: 500 }).subscribe({
      next: (list) => {
        this.all.set(list);
        this.total.set(list.length);
        this.draft.set(list.filter(r => r.status === 'draft').length);
        this.pending.set(list.filter(r => ['submitted','under_review'].includes(r.status)).length);
        this.approved.set(list.filter(r => r.status === 'approved').length);
        this.oos.set(list.filter(r => r.is_oos).length);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  applyFilter() {
    const kw = (this.filter.kw || '').toLowerCase();
    this.filtered.set(this.all().filter(r => {
      if (this.filter.status && r.status !== this.filter.status) return false;
      if (this.filter.quality === 'oos' && !r.is_oos) return false;
      if (this.filter.quality === 'oot' && !(r.is_oot && !r.is_oos)) return false;
      if (this.filter.quality === 'ok' && (r.is_oos || r.is_oot)) return false;
      if (kw) {
        return (r.result_code + ' ' + (r.sample_code||'') + ' ' + (r.analyst||'') + ' ' + (r.product_name||'')).toLowerCase().includes(kw);
      }
      return true;
    }));
  }

  statusClass(s: ResultStatus): string {
    return { draft: 'badge-secondary', submitted: 'badge-info', approved: 'badge-success',
      rejected: 'badge-danger', under_review: 'badge-warning' }[s] || 'badge';
  }
  statusLabel(s: ResultStatus): string {
    return { draft: '草稿', submitted: '待审批', approved: '已批准', rejected: '已驳回', under_review: '审核中' }[s] || s;
  }

  quickApprove(r: any) {
    this.svc.review(r.id, { approved: true, comments: '列表快速批准' }).subscribe({
      next: () => { this.message.add({ severity: 'success', summary: '已批准' }); this.load(); },
      error: e => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }
}
