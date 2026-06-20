import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule, FormArray, Validators, FormBuilder } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { FieldsetModule } from 'primeng/fieldset';
import { TabViewModule } from 'primeng/tabview';
import { MessageService } from 'primeng/api';
import { TestResultService } from '../../../shared/services/test-result.service';
import { SampleService } from '../../../shared/services/sample.service';
import { ProtocolService } from '../../../shared/services/protocol.service';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-test-result-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, InputTextModule,
    InputTextareaModule, InputNumberModule, CalendarModule, DropdownModule, ToastModule, DividerModule, FieldsetModule, TabViewModule],
  providers: [MessageService, FormBuilder],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <div class="card">
        <div class="flex justify-between flex-wrap gap-3 mb-4">
          <div class="flex items-center gap-3">
            <a routerLink="/test-results" pButton icon="pi pi-arrow-left" class="p-button-text p-button-plain"></a>
            <div>
              <h2 class="page-title m-0">{{ isEdit ? '📝 编辑检测结果' : '➕ 录入检测结果' }}</h2>
              <p class="page-subtitle m-0">填写各项检测数据，系统自动判定 OOS/OOT 质量判定</p>
            </div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <a routerLink="/test-results" pButton label="取消" class="p-button-outlined" icon="pi pi-times"></a>
            <button pButton label="保存为草稿" icon="pi pi-save" (click)="submit('draft')" [disabled]="saving()" class="p-button-outlined"></button>
            <button pButton label="保存并提交审批" icon="pi pi-check-circle" (click)="submit('save_and_submit')" style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;" [disabled]="saving()" [loading]="saving()"></button>
          </div>
        </div>
      </div>

      <form [formGroup]="form">
        <div class="card mb-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="field-label">关联样品 <span class="text-red-500">*</span></label>
              <p-dropdown formControlName="sample_id" [options]="sampleOpts" optionLabel="label" optionValue="id"
                [filter]="true" placeholder="选择样品" styleClass="w-full" [disabled]="!!initialSample || isEdit">
                <ng-template let-item pTemplate="item">
                  <div>
                    <div><b>{{ item.sample_code || item.label }}</b></div>
                    <div class="text-xs text-gray-500">{{ item.protocol_code || '' }} · {{ item.condition_code || '' }}</div>
                  </div>
                </ng-template>
              </p-dropdown>
            </div>
            <div>
              <label class="field-label">检测日期 <span class="text-red-500">*</span></label>
              <p-calendar formControlName="testing_date" dateFormat="yy-mm-dd" styleClass="w-full"></p-calendar>
            </div>
            <div>
              <label class="field-label">分析员 <span class="text-red-500">*</span></label>
              <input type="text" pInputText formControlName="analyst" placeholder="如：张三" class="w-full">
            </div>
            <div>
              <label class="field-label">检测方法</label>
              <input type="text" pInputText formControlName="method_name" placeholder="如：HPLC-UV法" class="w-full">
            </div>
            <div>
              <label class="field-label">检测仪器</label>
              <input type="text" pInputText formControlName="instrument" placeholder="如：Agilent 1260" class="w-full">
            </div>
            <div>
              <label class="field-label">关联取样记录ID</label>
              <p-inputNumber formControlName="sampling_record_id" mode="decimal" class="w-full"></p-inputNumber>
            </div>
            <div class="md:col-span-2">
              <label class="field-label">总体结论 / 摘要</label>
              <textarea pInputTextarea formControlName="summary" [rows]="2" class="w-full" placeholder="总结本次检测的总体情况"></textarea>
            </div>
          </div>
        </div>

        <div class="p-4 mt-5">
          <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h3 class="section-title border-none">📋 检测项目明细</h3>
            <button type="button" pButton label="添加项目" icon="pi pi-plus" class="p-button-sm" (click)="addItem()"></button>
            <div class="flex gap-2 flex-wrap">
              <button type="button" pButton label="含量" icon="pi pi-magic" class="p-button-sm p-button-outlined" (click)="addPreset('assay')"></button>
              <button type="button" pButton label="有关物质" icon="pi pi-plus-circle" class="p-button-sm p-button-outlined" (click)="addPreset('related')"></button>
              <button type="button" pButton label="溶出度" icon="pi pi-plus" class="p-button-sm p-button-outlined" (click)="addPreset('dissolution')"></button>
              <button type="button" pButton label="水分" icon="pi pi-plus-circle" class="p-button-sm p-button-outlined" (click)="addPreset('water')"></button>
              <button type="button" pButton label="外观" icon="pi pi-eye" class="p-button-sm p-button-outlined" (click)="addPreset('appearance')"></button>
            </div>
          </div>

          <div formArrayName="items">
            @for (item of items.controls; track item; let i = $index) {
              <div class="border p-4 rounded-lg mb-3 bg-white" style="border: 1px solid #e5e7eb;">
                <div [formGroupName]="i" class="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div class="md:col-span-1">
                    <label class="field-label">检测项目</label>
                    <input type="text" pInputText formControlName="test_name" class="w-full" placeholder="如：含量">
                  </div>
                  <div class="md:col-span-2">
                    <label class="field-label">质量标准/规格限度</label>
                    <input type="text" pInputText formControlName="specification" class="w-full" placeholder="如：95.0%~105.0%">
                  </div>
                  <div>
                    <label class="field-label">结果值</label>
                    <input type="text" pInputText formControlName="result_value" class="w-full" placeholder="如：99.5%">
                  </div>
                  <div>
                    <label class="field-label">单位</label>
                    <input type="text" pInputText formControlName="unit" class="w-full" placeholder="%/mg/℃">
                  </div>
                  <div class="flex items-end gap-1">
                    <button type="button" pButton icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger" (click)="removeItem(i)" *ngIf="items.length > 1"></button>
                    <span class="badge text-sm" *ngIf="getItemOos(i)" [ngClass]="item?.is_oos?'badge-danger':'item?.is_oot?'badge-warning':'badge-success'">
                      {{item?.is_oos?'OOS':item?.is_oot?'OOT':'合格'}}
                    </span>
                  </div>
                  <div class="md:col-span-3">
                    <label class="field-label">结果描述（可选）</label>
                    <input type="text" pInputText formControlName="result_text" class="w-full" placeholder="详细检测过程/备注">
                  </div>
                  <div class="md:col-span-2">
                    <label class="field-label">趋势对比（可选）</label>
                    <p-dropdown formControlName="is_oot_manual" [options]="[{label:'否',value:false},{label:'是',value:true}]" optionLabel="label" optionLabel="value" styleClass="w-full" [showClear]="true" placeholder="自动判定"></p-dropdown>
                  </div>
                </div>
              </div>
            }
          </div>
          @if (items.length === 0) {
            <div class="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
              暂无检测项目，点击上方添加
            </div>
          }
          <div class="mt-4 p-3 rounded-lg text-xs" [ngClass]="formHasOos ? 'bg-red-50' : formHasOot ? 'bg-yellow-50' : 'bg-green-50'">
              <div class="font-semibold mb-1" [ngClass]="formHasOos ? 'text-red-700' : formHasOot ? 'text-yellow-700' : 'text-green-700'">
                📊 系统自动质量判定：
                <span *ngIf="formHasOos" class="ml-2">存在 <b class="text-red-700">❌ 检测结果为 OOS（超出质量标准）</b></span>
                <span *ngIf="!formHasOos && formHasOot" class="ml-2"><b class="text-yellow-700">⚠️ 存在 OOT（超出趋势）</span>
                <span *ngIf="!formHasOos && !formHasOot" class="ml-2"><b class="text-green-700">✅ 所有项目符合规定</b></span>
              </div>
              <div class="text-gray-600">判定依据：各结果值与规格限度对比；规格支持区间写法：95.0~105.0 / ≥98.0 / ≤0.5 / 符合规定 等</div>
            </div>
        </form>
      </div>
  `
})
export class TestResultEditComponent implements OnInit {
  saving = signal(false);
  samples = signal<any[]>([]);
  sampleOpts: any[] = [];
  initialSample: number | null = null;
  isEdit = false;
  editingId: number | null = null;

  form: FormGroup;
  presets: Record<string, any> = {
    content: { test_name: '含量', specification: '95.0%~105.0%', unit: '%' },
    related: { test_name: '有关物质', specification: '≤0.5%', unit: '%' },
    dissolution: { test_name: '溶出度', specification: '≥85%', unit: '%' },
    water: { test_name: '水分', specification: '≤3.0%', unit: '%' },
    appearance: { test_name: '外观性状', specification: '符合规定', result_value: '符合规定', unit: '' },
  };

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private svc: TestResultService,
    private sampleSvc: SampleService,
    private protocolSvc: ProtocolService,
    private message: MessageService,
  ) {
    this.form = this.fb.group({
      sample_id: [null, Validators.required],
      testing_date: [new Date(),
      analyst: ['', Validators.required],
      method_name: [''],
      instrument: [''],
      sampling_record_id: [null],
      summary: [''],
      items: this.fb.array([]),
    });
  }

  get items(): FormArray { return this.form.get('items') as FormArray; }

  getItem(i: number): any { return this.items.at(i).value; }

  get formHasOos(): boolean {
    return this.items.controls.some(c => c.value?.is_oos; }
  get formHasOot(): boolean {
    return this.items.controls.some(c => c.value?.is_oot); }

  getItemOos(i: number): any { return this.getItem(i); }
  getItemOot(i: number): any { return this.getItem(i); }

  ngOnInit(): void {
    this.sampleSvc.list({ limit: 500 }).subscribe(list => {
      this.samples.set(list);
      this.sampleOpts = list.filter(s => s.status !== 'destroyed').map(s => ({
        ...s,
        label: `${s.sample_code} · ${s.protocol_code || ''} - ${s.condition_code || ''}
      }));
    });
    const editId = this.route.snapshot.queryParams['edit'];
    const sampleId = this.route.snapshot.queryParams['sample'];
    const srId = this.route.snapshot.queryParams['sr'];
    const tpId = this.route.snapshot.queryParams['tp'];

    if (sampleId) {
      this.initialSample = Number(sampleId);
      this.form.patchValue({ sample_id: Number(sampleId);
    }
    if (srId) this.form.patchValue({ sampling_record_id: Number(srId);
    if (editId) { this.isEdit = true; this.editingId = Number(editId);
      this.svc.get(this.editingId).subscribe(r => {
        this.form.patchValue({ ...r, testing_date: new Date(r.testing_date) });
        this.items.clear();
        (r.items || []).forEach(item => this.addItem(item);
      });
    } else {
      this.addPreset('content');
      this.addPreset('related');
      this.addPreset('related');
    }
  }

  addItem(data?: any) {
    this.items.push(this.fb.group({
      id: [data?.id || null],
      test_name: [data?.test_name || ''],
      specification: [data?.specification || ''],
      result_value: [data?.result_value || ''],
      result_text: [data?.result_text || ''],
      unit: [data?.unit || ''],
      is_oos: [data?.is_oos || false],
      is_oot: [data?.is_oot || false],
      remarks: [''],
    }));
  }

  removeItem(i: number) { this.items.removeAt(i); }

  addPreset(key: string) {
    this.addItem(this.presets[key]);
  }

  fmtDate(d: any): string {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  submit(mode: 'draft' | 'save_and_submit') {
    if (!this.form.valid) return;
    this.saving.set(true);
    const raw: any = {
      ...this.form.value,
      testing_date: this.fmtDate(this.form.value.testing_date),
      status: mode === 'save_and_submit' ? 'submitted' : 'draft',
    };
    const req = this.isEdit && this.editingId
      ? this.svc.update(this.editingId!, raw)
      : this.svc.create(raw);
    req.subscribe({
      next: (r: any) => {
        this.message.add({ severity: 'success', summary: mode === 'draft' ? '已保存草稿' : '已提交审批', detail: r.result_code || '#' + r.id });
        setTimeout(() => this.router.navigate(['/test-results', r.id]), 600);
      },
      error: e => { this.saving.set(false);
        this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail }) }
    });
  }
}
