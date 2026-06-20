import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ProtocolService, ProtocolUpdate } from '../../shared/services/protocol.service';
import { AuthService } from '../../shared/services/auth.service';
import { Protocol, ProtocolStatus } from '../../shared/models';

@Component({
  selector: 'app-protocol-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, InputTextModule, DropdownModule,
    TableModule, TagModule, CardModule, TooltipModule, ConfirmDialogModule, ToastModule],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <div class="card">
        <div class="page-header flex-wrap">
          <div>
            <h2 class="page-title">📋 试验方案管理</h2>
            <p class="page-subtitle">创建、审批、跟踪所有药物稳定性试验方案</p>
          </div>
          <a *ngIf="auth.hasRole(['researcher', 'qa', 'admin'])"
            routerLink="/protocols/new" pButton label="新建方案" icon="pi pi-plus" style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;"></a>
        </div>
      </div>

      <div class="card">
        <form [formGroup]="filterForm" class="grid-4 mb-4 gap-3">
          <div>
            <label class="field-label">方案编号/产品名</label>
            <input type="text" pInputText formControlName="keyword" placeholder="搜索...">
          </div>
          <div>
            <label class="field-label">方案状态</label>
            <p-dropdown formControlName="status" [options]="statusOptions" optionLabel="label" optionValue="value"
              placeholder="全部状态" [showClear]="true" styleClass="w-full">
            </p-dropdown>
          </div>
          <div class="col-span-2 flex items-end gap-2">
            <button pButton label="查询" icon="pi pi-search" (click)="refresh()"></button>
            <button pButton label="重置" icon="pi pi-refresh" styleClass="p-button-outlined"
              (click)="filterForm.reset(); refresh()"></button>
          </div>
        </form>

        @if (loading()) {
          <div class="text-center py-12 text-gray-500"><i class="pi pi-spin pi-spinner text-3xl"></i></div>
        } @else {
          <p-table [value]="filteredList()" [paginator]="true" [rows]="10" responsiveLayout="scroll"
            [rowsPerPageOptions]="[10, 20, 50]" [tableStyle]="{ 'min-width': '80rem' }">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:150px;">方案编号</th>
                <th>产品名称</th>
                <th style="width:130px;">批次号</th>
                <th style="width:110px;">试验类型</th>
                <th style="width:100px;">时长</th>
                <th style="width:120px;">起始日期</th>
                <th style="width:120px;">状态</th>
                <th style="width:100px;">创建人</th>
                <th style="width:160px;" class="text-center">操作</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-p>
              <tr>
                <td><b class="text-blue-700">{{ p.protocol_code }}</b></td>
                <td>
                  <div class="font-medium">{{ p.product_name }}</div>
                  <div class="text-xs text-gray-500">{{ p.title }}</div>
                </td>
                <td>{{ p.batch_number }}</td>
                <td>
                  <p-tag [severity]="{长期:'success',加速:'info',中间:'warning',影响因素:'danger'}[p.study_type] || 'secondary'"
                    [value]="p.study_type"></p-tag>
                </td>
                <td>{{ p.total_duration_months }}月</td>
                <td>{{ p.start_date }}</td>
                <td>
                  <span class="badge" [ngClass]="statusClass(p.status)">
                    {{ statusLabel(p.status) }}
                  </span>
                </td>
                <td>{{ p.created_by_name || '-' }}</td>
                <td class="flex gap-1 justify-center">
                  <a [routerLink]="['/protocols', p.id]" pButton icon="pi pi-eye" class="p-button-text p-button-sm"
                    pTooltip="详情" tooltipPosition="left"></a>

                  <button *ngIf="p.status === 'draft' && (isOwner(p) || auth.hasRole(['admin']))"
                    pButton icon="pi pi-pencil" class="p-button-text p-button-sm"
                    (click)="quickApprove(p, 'approved', '提交审核')" pTooltip="提交审批" tooltipPosition="top"></button>

                  <button *ngIf="p.status === 'pending_approval' && auth.hasRole(['qa', 'admin'])"
                    pButton icon="pi pi-check" class="p-button-text p-button-sm p-button-success"
                    (click)="quickApprove(p, 'in_progress', '批准方案并激活')" pTooltip="QA批准" tooltipPosition="top"></button>

                  <button *ngIf="p.status === 'pending_approval' && auth.hasRole(['qa', 'admin'])"
                    pButton icon="pi pi-times" class="p-button-text p-button-sm p-button-danger"
                    (click)="quickApprove(p, 'rejected', '驳回')" pTooltip="驳回" tooltipPosition="top"></button>

                  <p-confirmDialog key="confirm"></p-confirmDialog>
                  <button *ngIf="p.status === 'draft' && (isOwner(p) || auth.hasRole(['admin']))"
                    pButton icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
                    (click)="deleteProtocol(p)" pTooltip="删除" tooltipPosition="right"></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="9">
                <div class="empty-state"><i class="pi pi-file-o"></i><h3>暂无试验方案</h3>
                  <p>点击右上角「新建方案」创建第一个稳定性试验方案</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>
  `
})
export class ProtocolListComponent implements OnInit {
  loading = signal(false);
  allList = signal<Protocol[]>([]);

  filterForm = new FormGroup({
    keyword: new FormControl(''),
    status: new FormControl<ProtocolStatus | ''>(''),
  });

  statusOptions = [
    { label: '草稿', value: 'draft' },
    { label: '待审批', value: 'pending_approval' },
    { label: '进行中', value: 'in_progress' },
    { label: '已完成', value: 'completed' },
    { label: '已驳回', value: 'rejected' },
    { label: '已归档', value: 'archived' },
  ];

  filteredList = signal<Protocol[]>([]);

  constructor(
    public auth: AuthService,
    private protocol: ProtocolService,
    private confirm: ConfirmationService,
    private message: MessageService,
  ) {
    this.filterForm.valueChanges.subscribe(() => this.applyFilter());
  }

  ngOnInit(): void { this.refresh(); }

  refresh() {
    this.loading.set(true);
    const status = this.filterForm.get('status')?.value || undefined;
    this.protocol.list(status ? { status } : undefined).subscribe({
      next: (list) => {
        this.allList.set(list);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  applyFilter() {
    const kw = (this.filterForm.value.keyword || '').toLowerCase();
    const st = this.filterForm.value.status;
    this.filteredList.set(this.allList().filter(p => {
      const matchKw = !kw ||
        p.protocol_code.toLowerCase().includes(kw) ||
        p.product_name.toLowerCase().includes(kw) ||
        p.batch_number.toLowerCase().includes(kw);
      const matchSt = !st || p.status === st;
      return matchKw && matchSt;
    }));
  }

  isOwner(p: Protocol): boolean { return this.auth.currentUser?.id === p.created_by; }

  statusClass(s: ProtocolStatus): string {
    return {
      draft: 'badge-secondary', pending_approval: 'badge-warning', in_progress: 'badge-info',
      completed: 'badge-success', rejected: 'badge-danger', archived: 'badge-dark',
    }[s] || 'badge';
  }
  statusLabel(s: ProtocolStatus): string {
    return { draft: '草稿', pending_approval: '待审批', in_progress: '进行中',
      completed: '已完成', rejected: '已驳回', archived: '已归档' }[s] || s;
  }

  quickApprove(p: Protocol, status: ProtocolStatus, action: string) {
    this.confirm.confirm({
      key: 'confirm',
      header: `${action}`,
      message: `确定${action}「${p.protocol_code}」？`,
      acceptLabel: '确定', rejectLabel: '取消',
      accept: () => {
        this.protocol.updateStatus(p.id, status, `${action}操作`).subscribe({
          next: () => { this.message.add({ severity: 'success', summary: '操作成功' }); this.refresh(); },
          error: (e) => this.message.add({ severity: 'error', summary: '操作失败', detail: e.error?.detail })
        });
      }
    });
  }

  deleteProtocol(p: Protocol) {
    this.confirm.confirm({
      key: 'confirm',
      header: '删除确认',
      message: `确定删除「${p.protocol_code}」？此操作不可撤销。`,
      acceptLabel: '删除', rejectLabel: '取消',
      accept: () => {
        this.protocol.delete(p.id).subscribe({
          next: () => { this.message.add({ severity: 'success', summary: '删除成功' }); this.refresh(); },
          error: (e) => this.message.add({ severity: 'error', summary: '删除失败', detail: e.error?.detail })
        });
      }
    });
  }
}
