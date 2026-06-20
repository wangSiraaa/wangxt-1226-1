import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SampleService } from '../../../shared/services/sample.service';
import { ProtocolService } from '../../../shared/services/protocol.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Sample, SampleStatus } from '../../../shared/models';

@Component({
  selector: 'app-sample-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, TableModule, TagModule,
    DialogModule, InputTextModule, InputTextareaModule, InputNumberModule, CalendarModule, DropdownModule,
    MultiSelectModule, ToastModule, ConfirmDialogModule, TooltipModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmDialog key="confirm"></p-confirmDialog>

    <div class="space-y-6">
      <div class="card">
        <div class="page-header flex-wrap gap-4">
          <div>
            <h2 class="page-title">🧪 样品生命周期管理</h2>
            <p class="page-subtitle">样品入箱、按时间点取样、出箱控制、锁定管理</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button *ngIf="auth.hasRole(['warehouse', 'qa', 'admin'])"
              pButton label="批量入箱" icon="pi pi-sign-in" [disabled]="selectedSamples().length === 0"
              [styleClass]="selectedSamples().length === 0 ? 'p-button-outlined' : ''" (click)="showInDlg = true"></button>
            <button *ngIf="auth.hasRole(['warehouse', 'qa', 'admin'])"
              pButton label="批量出箱" icon="pi pi-sign-out" class="p-button-help"
              [disabled]="selectedSamples().length === 0" (click)="showOutDlg = true"></button>
            <button *ngIf="auth.hasRole(['qa', 'admin'])"
              pButton label="锁定样品" icon="pi pi-lock" class="p-button-warning"
              [disabled]="selectedSamples().filter(s=>!s.is_locked).length===0" (click)="showLockDlg = true"></button>
          </div>
        </div>

        <div class="grid-5 mt-5 mb-5 gap-3">
          <div class="stat-mini"><div class="text-xs text-gray-500">样品总数</div><div class="text-2xl font-bold text-gray-800">{{ allList().length }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">在储存</div><div class="text-2xl font-bold text-green-600">{{ counts.inStorage }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">取样中/已取</div><div class="text-2xl font-bold text-blue-600">{{ counts.out }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">已销毁</div><div class="text-2xl font-bold text-gray-500">{{ counts.destroyed }}</div></div>
          <div class="stat-mini"><div class="text-xs text-gray-500">🔒 锁定</div><div class="text-2xl font-bold text-red-600">{{ counts.locked }}</div></div>
        </div>

        <form [formGroup]="filterForm" class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
          <div>
            <label class="field-label">方案/批次</label>
            <input type="text" pInputText formControlName="kw" placeholder="搜索样品编号/方案">
          </div>
          <div>
            <label class="field-label">储存条件</label>
            <p-dropdown formControlName="conditionId" [options]="conditionOptions" optionLabel="label" optionValue="value"
              [showClear]="true" placeholder="全部条件" styleClass="w-full"></p-dropdown>
          </div>
          <div>
            <label class="field-label">状态</label>
            <p-multiSelect formControlName="status" [options]="statusOptions" optionLabel="label" optionValue="value"
              placeholder="全部状态" [display]="'chip'" styleClass="w-full" [maxSelectedLabels]="2"></p-multiSelect>
          </div>
          <div>
            <label class="field-label">锁定</label>
            <p-dropdown formControlName="locked" [options]="[{label:'全部',value:''},{label:'已锁定',value:true},{label:'未锁定',value:false}]"
              optionLabel="label" optionValue="value" styleClass="w-full" placeholder="全部"></p-dropdown>
          </div>
          <div class="flex items-end gap-2">
            <button pButton label="查询" icon="pi pi-search" (click)="doSearch()"></button>
            <button pButton label="重置" icon="pi pi-refresh" styleClass="p-button-outlined"
              (click)="filterForm.reset({status:[],locked:''}); doSearch()"></button>
          </div>
        </form>
      </div>

      <div class="card">
        @if (loading()) {
          <div class="text-center py-16"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
        } @else {
          <p-table [value]="filtered()" [paginator]="true" [rows]="15" [rowsPerPageOptions]="[15, 30, 60, 100]"
            responsiveLayout="scroll" [tableStyle]="{ 'min-width': '80rem' }"
            selectionMode="multiple" [(selection)]="_selected" (onSelectionChange)="syncSelected()">
            <ng-template pTemplate="caption">
              <div class="flex justify-between items-center">
                <b>样品列表</b>
                <span class="text-xs text-gray-500">已选择：<b>{{ selectedSamples().length }}</b> 条</span>
              </div>
            </ng-template>
            <ng-template pTemplate="header">
              <tr>
                <th style="width:3rem;"></th>
                <th style="width:140px;">样品编号</th>
                <th>方案 / 产品</th>
                <th style="width:110px;">储存条件</th>
                <th style="width:120px;">位置</th>
                <th style="width:100px;">状态</th>
                <th style="width:120px;">锁定</th>
                <th style="width:120px;">入箱时间</th>
                <th style="width:140px;" class="text-center">操作</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-s>
              <tr [pSelectableRow]="s" [style]="{ opacity: s.is_locked ? 0.9 : 1, background: s.is_locked ? '#fef2f2' : '' }">
                <td><p-tableCheckbox [value]="s"></p-tableCheckbox></td>
                <td><a [routerLink]="['/samples', s.id]"><b>{{ s.sample_code }}</b></a></td>
                <td>
                  <div class="text-sm font-medium">{{ s.protocol_code || '#' + s.protocol_id }}</div>
                  <div class="text-xs text-gray-500">{{ s.product_name || '批次: ' + (s.batch_number || '') }}</div>
                </td>
                <td><p-tag [value]="s.condition_code || s.condition_id" severity="info"></p-tag></td>
                <td>
                  <div class="text-sm">{{ s.chamber_position || s.location || '-' }}</div>
                </td>
                <td><span class="badge" [ngClass]="statusClass(s.status)">{{ statusLabel(s.status) }}</span></td>
                <td>
                  <span *ngIf="s.is_locked" class="badge badge-danger">🔒 锁定</span>
                  <span *ngIf="!s.is_locked" class="badge badge-success">正常</span>
                </td>
                <td class="text-xs">{{ s.in_chamber_at?.slice(0,16).replace('T',' ') || '-' }}</td>
                <td class="text-center">
                  <a [routerLink]="['/samples', s.id]" pButton icon="pi pi-eye" class="p-button-text p-button-sm" pTooltip="详情"></a>
                  <a *ngIf="s.status === 'in_storage' && !s.is_locked"
                    [routerLink]="['/samples', s.id, 'sampling']"
                    pButton icon="pi pi-sign-out" class="p-button-text p-button-sm p-button-success" pTooltip="取样"></a>
                  <button *ngIf="s.status === 'in_storage' && !s.is_locked && auth.hasRole(['warehouse','qa','admin'])"
                    pButton icon="pi pi-sign-out" class="p-button-text p-button-sm p-button-help" (click)="quickOut(s)" pTooltip="单次出箱"></button>
                  <button *ngIf="s.is_locked && auth.hasRole(['qa','admin'])"
                    pButton icon="pi pi-unlock" class="p-button-text p-button-sm p-button-warning" (click)="quickUnlock(s)" pTooltip="解锁"></button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="9">
                <div class="empty-state"><i class="pi pi-box"></i>
                  <h3>暂无样品</h3><p>请在「方案详情」中为试验方案生成样品</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        }
      </div>
    </div>

    <p-dialog header="批量入箱" [(visible)]="showInDlg" [modal]="true" [style]="{ width: '520px' }">
      <div *ngIf="selectedSamples().length" class="space-y-3">
        <div class="p-3 bg-blue-50 rounded text-sm">
          已选择 <b>{{ selectedSamples().length }}</b> 个样品入箱
        </div>
        <form [formGroup]="inForm">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="md:col-span-2">
              <label class="field-label">位置/温湿度箱 <span class="text-red-500">*</span></label>
              <input type="text" pInputText formControlName="location" placeholder="如：STB-001 / QC-A区" class="w-full">
            </div>
            <div>
              <label class="field-label">箱内位置</label>
              <input type="text" pInputText formControlName="chamber_position" placeholder="如：A-03 货架第2层" class="w-full">
            </div>
            <div>
              <label class="field-label">温度(℃)</label>
              <p-inputNumber formControlName="temperature" mode="decimal" [minFractionDigits]="1" class="w-full"></p-inputNumber>
            </div>
            <div>
              <label class="field-label">湿度(%RH)</label>
              <p-inputNumber formControlName="humidity" mode="decimal" class="w-full"></p-inputNumber>
            </div>
            <div class="md:col-span-2">
              <label class="field-label">备注</label>
              <textarea pInputTextarea formControlName="remarks" [rows]="2" class="w-full"></textarea>
            </div>
          </div>
        </form>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showInDlg = false"></button>
        <button pButton label="确认入箱" (click)="doPutIn()"></button>
      </div>
    </p-dialog>

    <p-dialog header="批量出箱" [(visible)]="showOutDlg" [modal]="true" [style]="{ width: '520px' }">
      <div *ngIf="selectedSamples().length" class="space-y-3">
        <div class="p-3 bg-yellow-50 rounded text-sm">
          <span *ngIf="selectedSamples().some(s=>s.is_locked)" class="text-red-600 block mb-2">⚠️ 部分样品已被锁定，将自动跳过</span>
          将对 <b>{{ selectedSamples().filter(s=>!s.is_locked).length }}</b> 个样品执行出箱
        </div>
        <form [formGroup]="outForm">
          <div class="space-y-3">
            <div>
              <label class="field-label">出箱原因 <span class="text-red-500">*</span></label>
              <input type="text" pInputText formControlName="reason" placeholder="如：T6M 取样检测 / 外观检查 / 偏差处理" class="w-full">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label">温度(℃)</label>
                <p-inputNumber formControlName="temperature" mode="decimal" [minFractionDigits]="1" class="w-full"></p-inputNumber>
              </div>
              <div>
                <label class="field-label">湿度(%RH)</label>
                <p-inputNumber formControlName="humidity" mode="decimal" class="w-full"></p-inputNumber>
              </div>
            </div>
            <div>
              <label class="field-label">备注</label>
              <textarea pInputTextarea formControlName="remarks" [rows]="2" class="w-full"></textarea>
            </div>
          </div>
        </form>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showOutDlg = false"></button>
        <button pButton label="确认出箱" styleClass="p-button-help" (click)="doTakeOut()"></button>
      </div>
    </p-dialog>

    <p-dialog header="锁定样品" [(visible)]="showLockDlg" [modal]="true" [style]="{ width: '450px' }">
      <div class="space-y-3">
        <div class="p-3 bg-red-50 rounded text-sm">
          锁定后样品无法出箱/取样，需 QA 手工解锁
        </div>
        <form [formGroup]="lockForm">
          <div>
            <label class="field-label">锁定原因 <span class="text-red-500">*</span></label>
            <textarea pInputTextarea formControlName="lock_reason" [rows]="3" placeholder="如：温湿度偏差超出容差，需暂停使用" class="w-full"></textarea>
          </div>
        </form>
      </div>
      <div class="flex justify-end gap-2 mt-5">
        <button pButton label="取消" styleClass="p-button-outlined" (click)="showLockDlg = false"></button>
        <button pButton label="确认锁定" styleClass="p-button-warning" (click)="doLock()"></button>
      </div>
    </p-dialog>
  `
})
export class SampleListComponent implements OnInit {
  loading = signal(true);
  allList = signal<Sample[]>([]);
  filtered = signal<Sample[]>([]);
  _selected: Sample[] = [];
  selectedSamples = signal<Sample[]>([]);
  counts = { inStorage: 0, out: 0, destroyed: 0, locked: 0 };

  showInDlg = false;
  showOutDlg = false;
  showLockDlg = false;

  filterForm = new FormGroup({
    kw: new FormControl(''),
    conditionId: new FormControl<number | null>(null),
    status: new FormControl<string[]>([]),
    locked: new FormControl<'' | boolean>(''),
  });

  inForm = new FormGroup({
    location: new FormControl('', Validators.required),
    chamber_position: new FormControl(''),
    temperature: new FormControl<number | null>(null),
    humidity: new FormControl<number | null>(null),
    remarks: new FormControl(''),
  });
  outForm = new FormGroup({
    reason: new FormControl('', Validators.required),
    temperature: new FormControl<number | null>(null),
    humidity: new FormControl<number | null>(null),
    remarks: new FormControl(''),
  });
  lockForm = new FormGroup({
    lock_reason: new FormControl('', Validators.required),
  });

  conditionOptions: any[] = [];
  statusOptions = [
    { label: '已生成', value: 'generated' },
    { label: '在储存', value: 'in_storage' },
    { label: '取样中', value: 'out_for_sampling' },
    { label: '已取样', value: 'sampled' },
    { label: '已归还', value: 'returned' },
    { label: '已销毁', value: 'destroyed' },
  ];

  constructor(
    public auth: AuthService,
    private sample: SampleService,
    private protocol: ProtocolService,
    private route: ActivatedRoute,
    private message: MessageService,
    private confirm: ConfirmationService,
  ) {
    this.route.queryParams.subscribe(q => {
      if (q['protocol']) this.filterForm.patchValue({ kw: String(q['protocol']) });
    });
  }

  ngOnInit(): void { this.doSearch(); }

  syncSelected() { this.selectedSamples.set(this._selected || []); }

  doSearch() {
    this.loading.set(true);
    this.sample.list({ limit: 500 }).subscribe({
      next: (list) => {
        this.allList.set(list);
        this.counts.inStorage = list.filter(s => s.status === 'in_storage').length;
        this.counts.out = list.filter(s => ['out_for_sampling', 'sampled', 'returned'].includes(s.status)).length;
        this.counts.destroyed = list.filter(s => s.status === 'destroyed').length;
        this.counts.locked = list.filter(s => s.is_locked).length;
        const conds = new Map<number, string>();
        list.forEach(s => { if (s.condition_id && s.condition_code) conds.set(Number(s.condition_id), s.condition_code); });
        this.conditionOptions = Array.from(conds.entries()).map(([k,v]) => ({ label: v, value: k }));
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  applyFilter() {
    const f = this.filterForm.value;
    this.filtered.set(this.allList().filter(s => {
      if (f.kw) {
        const kw = String(f.kw).toLowerCase();
        const hay = (s.sample_code + ' ' + (s.protocol_code||'') + ' ' + (s.product_name||'') + ' ' + (s.batch_number||'')).toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (f.conditionId && Number(s.condition_id) !== Number(f.conditionId)) return false;
      if (f.status && f.status.length && !f.status.includes(s.status)) return false;
      if (f.locked !== '' && f.locked !== undefined && s.is_locked !== f.locked) return false;
      return true;
    }));
  }

  statusClass(s: SampleStatus): string {
    return {
      generated: 'badge-secondary', in_storage: 'badge-success', out_for_sampling: 'badge-info',
      sampled: 'badge-primary', returned: 'badge-info', destroyed: 'badge-dark',
      quarantine: 'badge-warning'
    }[s] || 'badge';
  }
  statusLabel(s: SampleStatus): string {
    return {
      generated: '已生成', in_storage: '在储存', out_for_sampling: '取样中',
      sampled: '已取样', returned: '已归还', destroyed: '已销毁',
      quarantine: '隔离'
    }[s] || s;
  }

  doPutIn() {
    if (!this.inForm.valid) return;
    const ids = this.selectedSamples().map(s => s.id);
    this.sample.putInChamber({ sample_ids: ids, ...this.inForm.value, ...(this.inForm.value as any) }).subscribe({
      next: () => { this.message.add({ severity: 'success', summary: `已将 ${ids.length} 个样品入箱` }); this.showInDlg = false; this.inForm.reset(); this.doSearch(); },
      error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }

  doTakeOut() {
    if (!this.outForm.valid) return;
    const ids = this.selectedSamples().filter(s => !s.is_locked).map(s => s.id);
    if (!ids.length) { this.message.add({ severity: 'warn', summary: '没有可用样品' }); return; }
    this.sample.takeOutChamber({ sample_ids: ids, ...this.outForm.value, ...(this.outForm.value as any) }).subscribe({
      next: () => { this.message.add({ severity: 'success', summary: `已出箱 ${ids.length} 个样品` }); this.showOutDlg = false; this.outForm.reset(); this.doSearch(); },
      error: (e) => this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail })
    });
  }

  doLock() {
    if (!this.lockForm.valid) return;
    const targets = this.selectedSamples().filter(s => !s.is_locked);
    let done = 0;
    const reason = this.lockForm.value.lock_reason || '';
    Promise.all(targets.map(s => new Promise<void>(resolve =>
      this.sample.lock(s.id, { lock_reason: reason }).subscribe({
        next: () => { done++; resolve(); }, error: () => resolve()
      })
    ))).then(() => {
      this.message.add({ severity: 'success', summary: `已锁定 ${done}/${targets.length} 个样品` });
      this.showLockDlg = false; this.lockForm.reset(); this.doSearch();
    });
  }

  quickOut(s: Sample) {
    this.confirm.confirm({
      key: 'confirm', header: '出箱确认',
      message: `确认出箱样品「${s.sample_code}」？`,
      accept: () => {
        this.sample.takeOutChamber({ sample_ids: [s.id], reason: '快速出箱（界面操作）' }).subscribe({
          next: () => { this.message.add({ severity: 'success', summary: '出箱成功' }); this.doSearch(); },
          error: (e) => this.message.add({ severity: 'error', detail: e.error?.detail })
        });
      }
    });
  }

  quickUnlock(s: Sample) {
    this.confirm.confirm({
      key: 'confirm', header: '解锁确认',
      message: `确认解锁样品「${s.sample_code}」？`,
      accept: () => {
        this.sample.unlock(s.id, { unlock_reason: 'QA手工解锁' }).subscribe({
          next: () => { this.message.add({ severity: 'success', summary: '解锁成功' }); this.doSearch(); },
          error: (e) => this.message.add({ severity: 'error', detail: e.error?.detail })
        });
      }
    });
  }
}
