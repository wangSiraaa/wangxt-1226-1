import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { DividerModule } from 'primeng/divider';
import { TabViewModule } from 'primeng/tabview';
import { FieldsetModule } from 'primeng/fieldset';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProtocolService } from '../../../shared/services/protocol.service';

@Component({
  selector: 'app-protocol-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, InputTextModule, InputTextareaModule,
    DropdownModule, CalendarModule, InputNumberModule, DividerModule, TabViewModule, FieldsetModule, CardModule, ToastModule],
  providers: [MessageService, FormBuilder],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <div class="card">
        <div class="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 class="page-title m-0">📝 新建试验方案</h2>
            <p class="page-subtitle m-0">填写基础信息、配置储存条件和取样时间点</p>
          </div>
          <div class="flex gap-2">
            <a routerLink="/protocols" pButton label="返回列表" icon="pi pi-arrow-left" class="p-button-outlined"></a>
            <button pButton label="保存为草稿" icon="pi pi-save" class="p-button-outlined"
              (click)="submitForm('save')" [disabled]="saving() || !form.valid"></button>
            <button pButton label="保存并提交审批" icon="pi pi-check-circle"
              style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;"
              (click)="submitForm('submit')" [disabled]="saving() || !form.valid" [loading]="saving()"></button>
          </div>
        </div>
      </div>

      <form [formGroup]="form" class="space-y-6">
        <p-tabView>
          <p-tabPanel header="① 基础信息">
            <div class="card space-y-4">
              <h3 class="section-title">药物信息</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="field-label">方案标题 <span class="text-red-500">*</span></label>
                  <input type="text" pInputText formControlName="title" placeholder="如：阿莫西林胶囊长期稳定性试验(2024批)" class="w-full">
                </div>
                <div>
                  <label class="field-label">产品名称 <span class="text-red-500">*</span></label>
                  <input type="text" pInputText formControlName="product_name" placeholder="如：阿莫西林胶囊" class="w-full">
                </div>
                <div>
                  <label class="field-label">批次号 <span class="text-red-500">*</span></label>
                  <input type="text" pInputText formControlName="batch_number" placeholder="如：B202401001" class="w-full">
                </div>
                <div>
                  <label class="field-label">规格</label>
                  <input type="text" pInputText formControlName="specification" placeholder="如：0.25g" class="w-full">
                </div>
                <div>
                  <label class="field-label">生产厂家</label>
                  <input type="text" pInputText formControlName="manufacturer" class="w-full">
                </div>
                <div>
                  <label class="field-label">包装类型</label>
                  <input type="text" pInputText formControlName="package_type" placeholder="如：铝塑板+纸盒" class="w-full">
                </div>
                <div>
                  <label class="field-label">试验类型 <span class="text-red-500">*</span></label>
                  <p-dropdown formControlName="study_type" [options]="studyTypes"
                    optionLabel="label" optionValue="value" styleClass="w-full" placeholder="选择">
                  </p-dropdown>
                </div>
                <div>
                  <label class="field-label">试验总时长（月）<span class="text-red-500">*</span></label>
                  <p-inputNumber formControlName="total_duration_months" [min]="1" [max]="60" mode="decimal" [showButtons]="true" class="w-full"></p-inputNumber>
                </div>
                <div>
                  <label class="field-label">开始日期 <span class="text-red-500">*</span></label>
                  <p-calendar formControlName="start_date" dateFormat="yy-mm-dd" styleClass="w-full"></p-calendar>
                </div>
                <div>
                  <label class="field-label">预期结束日期 <span class="text-red-500">*</span></label>
                  <p-calendar formControlName="expected_end_date" dateFormat="yy-mm-dd" styleClass="w-full"></p-calendar>
                </div>
              </div>

              <p-divider></p-divider>

              <h3 class="section-title">试验描述</h3>
              <div class="space-y-3">
                <div>
                  <label class="field-label">试验目的</label>
                  <textarea pInputTextarea formControlName="purpose" [rows]="2"
                    placeholder="简述本稳定性试验的目的和意义"></textarea>
                </div>
                <div>
                  <label class="field-label">检测范围 / 检测项目</label>
                  <textarea pInputTextarea formControlName="testing_scope" [rows]="3"
                    placeholder="如：外观、鉴别、含量、有关物质、溶出度、水分、微生物限度等"></textarea>
                </div>
                <div>
                  <label class="field-label">参考标准 / 法规依据</label>
                  <textarea pInputTextarea formControlName="reference_standards" [rows]="2"
                    placeholder="如：中国药典2020年版四部通则9001 原料药物与制剂稳定性试验指导原则"></textarea>
                </div>
              </div>
            </div>
          </p-tabPanel>

          <p-tabPanel header="② 储存条件">
            <div class="card space-y-4">
              <div class="flex justify-between items-center mb-4">
                <h3 class="section-title m-0 border-none">📦 配置不同的储存条件（温湿度箱）</h3>
                <button type="button" pButton label="添加储存条件" icon="pi pi-plus" class="p-button-sm" (click)="addStorage()"></button>
              </div>

              @if (storageConditions.length === 0) {
                <div class="text-center py-8 bg-gray-50 rounded-lg text-gray-500">
                  未添加储存条件，请点击上方按钮添加
                </div>
              }

              <div formArrayName="storage_conditions" class="space-y-4">
                @for (c of storageConditions.controls; track c; let i = $index) {
                  <fieldset class="border p-4 rounded-lg">
                    <legend class="px-2 font-semibold text-gray-700 flex items-center gap-2">
                      条件 #{{ i+1 }}
                      <button type="button" pButton icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
                        (click)="removeStorage(i)" *ngIf="storageConditions.length > 1"></button>
                    </legend>
                    <div [formGroupName]="i" class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                      <div>
                        <label class="field-label">条件代码 <span class="text-red-500">*</span></label>
                        <input type="text" pInputText formControlName="condition_code" placeholder="如：LT25 / ACC40 / REF2" class="w-full">
                      </div>
                      <div class="md:col-span-2">
                        <label class="field-label">条件名称 <span class="text-red-500">*</span></label>
                        <input type="text" pInputText formControlName="condition_name" placeholder="如：长期25℃/60%RH" class="w-full">
                      </div>
                      <div>
                        <label class="field-label">温度下限(℃)</label>
                        <p-inputNumber formControlName="temperature_min" mode="decimal" [minFractionDigits]="1" class="w-full"></p-inputNumber>
                      </div>
                      <div>
                        <label class="field-label">温度上限(℃)</label>
                        <p-inputNumber formControlName="temperature_max" mode="decimal" [minFractionDigits]="1" class="w-full"></p-inputNumber>
                      </div>
                      <div>
                        <label class="field-label">温度目标(℃)</label>
                        <p-inputNumber formControlName="temperature_target" mode="decimal" [minFractionDigits]="1" class="w-full"></p-inputNumber>
                      </div>
                      <div>
                        <label class="field-label">湿度下限(%RH)</label>
                        <p-inputNumber formControlName="humidity_min" mode="decimal" class="w-full"></p-inputNumber>
                      </div>
                      <div>
                        <label class="field-label">湿度上限(%RH)</label>
                        <p-inputNumber formControlName="humidity_max" mode="decimal" class="w-full"></p-inputNumber>
                      </div>
                      <div>
                        <label class="field-label">湿度目标(%RH)</label>
                        <p-inputNumber formControlName="humidity_target" mode="decimal" class="w-full"></p-inputNumber>
                      </div>
                      <div>
                        <label class="field-label">光照条件</label>
                        <input type="text" pInputText formControlName="light_condition" placeholder="如：避光/曝光" class="w-full">
                      </div>
                      <div>
                        <label class="field-label">位置</label>
                        <input type="text" pInputText formControlName="location" placeholder="如：QC实验室A区" class="w-full">
                      </div>
                      <div>
                        <label class="field-label">温湿度箱编号</label>
                        <input type="text" pInputText formControlName="chamber_id" placeholder="如：STB-001" class="w-full">
                      </div>
                    </div>
                  </fieldset>
                }
              </div>

              <div class="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 mt-4">
                💡 <b>常用条件预设：</b>
                <button type="button" class="mx-1 px-2 py-1 bg-white border rounded hover:bg-blue-100"
                  (click)="presetStorage('LT25')">长期 25℃/60%RH</button>
                <button type="button" class="mx-1 px-2 py-1 bg-white border rounded hover:bg-blue-100"
                  (click)="presetStorage('ACC40')">加速 40℃/75%RH</button>
                <button type="button" class="mx-1 px-2 py-1 bg-white border rounded hover:bg-blue-100"
                  (click)="presetStorage('REF5')">冷藏 2~8℃</button>
                <button type="button" class="mx-1 px-2 py-1 bg-white border rounded hover:bg-blue-100"
                  (click)="presetStorage('FRZ-20')">冷冻 ≤-20℃</button>
                <button type="button" class="mx-1 px-2 py-1 bg-white border rounded hover:bg-blue-100"
                  (click)="presetStorage('INT30')">中间 30℃/65%RH</button>
              </div>
            </div>
          </p-tabPanel>

          <p-tabPanel header="③ 取样时间点">
            <div class="card space-y-4">
              <div class="flex justify-between items-center mb-4">
                <h3 class="section-title m-0 border-none">⏱️ 配置取样时间点</h3>
                <div class="flex gap-2">
                  <button type="button" pButton label="自动生成时间点" icon="pi pi-magic" class="p-button-sm p-button-outlined"
                    (click)="autoGenerateTimepoints()"></button>
                  <button type="button" pButton label="添加时间点" icon="pi pi-plus" class="p-button-sm" (click)="addTimepoint()"></button>
                </div>
              </div>

              <div formArrayName="sampling_timepoints" class="space-y-3">
                @for (t of samplingTimepoints.controls; track t; let i = $index) {
                  <fieldset class="border p-4 rounded-lg" [formGroupName]="i">
                    <legend class="px-2 font-semibold text-gray-700 flex items-center gap-2">
                      {{ t.get('timepoint_label')?.value || 'T' + (t.get('timepoint_month')?.value || (i+1)) }}
                      <button type="button" pButton icon="pi pi-trash" class="p-button-text p-button-sm p-button-danger"
                        (click)="removeTimepoint(i)" *ngIf="samplingTimepoints.length > 1"></button>
                    </legend>
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
                      <div>
                        <label class="field-label">月数 <span class="text-red-500">*</span></label>
                        <p-inputNumber formControlName="timepoint_month" [min]="0" [max]="360" mode="decimal" class="w-full"
                          (onInput)="t.patchValue({ timepoint_label: 'T' + t.get('timepoint_month')?.value })"></p-inputNumber>
                      </div>
                      <div>
                        <label class="field-label">标签</label>
                        <input type="text" pInputText formControlName="timepoint_label" placeholder="如：T0 / 初始" class="w-full">
                      </div>
                      <div>
                        <label class="field-label">计划日期 <span class="text-red-500">*</span></label>
                        <p-calendar formControlName="planned_date" dateFormat="yy-mm-dd" styleClass="w-full"></p-calendar>
                      </div>
                      <div>
                        <label class="field-label">取样窗口±天数</label>
                        <div class="flex gap-2">
                          <p-inputNumber formControlName="window_before_days" [min]="0" [max]="30" mode="decimal" placeholder="前" styleClass="flex-1"></p-inputNumber>
                          <p-inputNumber formControlName="window_after_days" [min]="0" [max]="30" mode="decimal" placeholder="后" styleClass="flex-1"></p-inputNumber>
                        </div>
                      </div>
                      <div>
                        <label class="field-label">每条件样品数</label>
                        <p-inputNumber formControlName="sample_count_per_condition" [min]="1" [max]="100" mode="decimal" class="w-full"></p-inputNumber>
                      </div>
                    </div>
                  </fieldset>
                }
              </div>
            </div>
          </p-tabPanel>
        </p-tabView>
      </form>
    </div>
  `
})
export class ProtocolEditComponent implements OnInit {
  saving = signal(false);
  studyTypes = [
    { label: '长期试验（Long-term）', value: '长期' },
    { label: '加速试验（Accelerated）', value: '加速' },
    { label: '中间条件（Intermediate）', value: '中间' },
    { label: '影响因素试验（Stress）', value: '影响因素' },
    { label: '低温冷藏试验', value: '冷藏' },
    { label: '冷冻保存试验', value: '冷冻' },
  ];

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private protocol: ProtocolService,
    private router: Router,
    private route: ActivatedRoute,
    private message: MessageService,
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      product_name: ['', Validators.required],
      batch_number: ['', Validators.required],
      specification: [''],
      manufacturer: [''],
      package_type: [''],
      study_type: ['', Validators.required],
      total_duration_months: [12, Validators.required],
      start_date: [new Date(), Validators.required],
      expected_end_date: [new Date(new Date().getTime() + 365*24*3600*1000), Validators.required],
      purpose: [''],
      testing_scope: [''],
      reference_standards: [''],
      storage_conditions: this.fb.array([]),
      sampling_timepoints: this.fb.array([]),
    });
  }

  get storageConditions(): FormArray { return this.form.get('storage_conditions') as FormArray; }
  get samplingTimepoints(): FormArray { return this.form.get('sampling_timepoints') as FormArray; }

  ngOnInit(): void {
    this.presetStorage('LT25');
    this.presetStorage('ACC40');
    this.addTimepoint({ timepoint_month: 0, timepoint_label: 'T0 初始', window_before_days: 0, window_after_days: 1 });
    this.addTimepoint({ timepoint_month: 3, timepoint_label: 'T3M 3月', window_before_days: 3, window_after_days: 7 });
    this.addTimepoint({ timepoint_month: 6, timepoint_label: 'T6M 6月', window_before_days: 3, window_after_days: 7 });
    this.addTimepoint({ timepoint_month: 12, timepoint_label: 'T12M 12月', window_before_days: 7, window_after_days: 14 });
  }

  addStorage(data?: any) {
    this.storageConditions.push(this.fb.group({
      condition_code: [data?.condition_code || '', Validators.required],
      condition_name: [data?.condition_name || '', Validators.required],
      temperature_min: [data?.temperature_min ?? 25],
      temperature_max: [data?.temperature_max ?? 25],
      temperature_target: [data?.temperature_target ?? 25],
      humidity_min: [data?.humidity_min ?? 60],
      humidity_max: [data?.humidity_max ?? 60],
      humidity_target: [data?.humidity_target ?? 60],
      light_condition: [data?.light_condition || ''],
      location: [data?.location || ''],
      chamber_id: [data?.chamber_id || ''],
    }));
  }

  removeStorage(i: number) { this.storageConditions.removeAt(i); }

  presetStorage(key: string) {
    const presets: Record<string, any> = {
      'LT25': { condition_code: 'LT25', condition_name: '长期 25℃/60%RH', temperature_min: 20, temperature_max: 30, temperature_target: 25, humidity_min: 55, humidity_max: 65, humidity_target: 60, location: 'QC-A区', chamber_id: 'STB-001' },
      'ACC40': { condition_code: 'ACC40', condition_name: '加速 40℃/75%RH', temperature_min: 38, temperature_max: 42, temperature_target: 40, humidity_min: 72, humidity_max: 78, humidity_target: 75, location: 'QC-A区', chamber_id: 'STB-002' },
      'REF5': { condition_code: 'REF5', condition_name: '冷藏 2~8℃', temperature_min: 2, temperature_max: 8, temperature_target: 5, location: 'QC-B区冷藏', chamber_id: 'REF-001' },
      'FRZ-20': { condition_code: 'FRZ-20', condition_name: '冷冻 ≤-20℃', temperature_min: -25, temperature_max: -15, temperature_target: -20, location: 'QC-B区冷冻', chamber_id: 'FRZ-001' },
      'INT30': { condition_code: 'INT30', condition_name: '中间 30℃/65%RH', temperature_min: 28, temperature_max: 32, temperature_target: 30, humidity_min: 60, humidity_max: 70, humidity_target: 65, location: 'QC-A区', chamber_id: 'STB-003' },
    };
    this.addStorage(presets[key]);
  }

  addTimepoint(data?: any) {
    const start = this.form.get('start_date')?.value;
    const month = data?.timepoint_month ?? 0;
    let planned: Date = start ? new Date(start) : new Date();
    planned.setMonth(planned.getMonth() + month);

    this.samplingTimepoints.push(this.fb.group({
      timepoint_month: [month, Validators.required],
      timepoint_label: [data?.timepoint_label || `T${month}M`, Validators.required],
      planned_date: [planned, Validators.required],
      window_before_days: [data?.window_before_days ?? 3],
      window_after_days: [data?.window_after_days ?? 7],
      sample_count_per_condition: [data?.sample_count_per_condition ?? 2],
    }));
  }

  removeTimepoint(i: number) { this.samplingTimepoints.removeAt(i); }

  autoGenerateTimepoints() {
    const total = this.form.get('total_duration_months')?.value || 12;
    const presets = [0, 3, 6, 9, 12, 18, 24, 36, 48, 60];
    this.samplingTimepoints.clear();
    for (const m of presets) {
      if (m <= total) {
        this.addTimepoint({
          timepoint_month: m,
          timepoint_label: m === 0 ? 'T0 初始' : `T${m}M ${m}月`,
          window_before_days: m === 0 ? 0 : (m >= 12 ? 7 : 3),
          window_after_days: m === 0 ? 1 : (m >= 12 ? 14 : 7),
        });
      }
    }
  }

  formatDate(d: any): string {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }

  submitForm(mode: 'save' | 'submit') {
    if (!this.form.valid) return;
    this.saving.set(true);

    const raw = this.form.value;
    const payload: any = {
      ...raw,
      start_date: this.formatDate(raw.start_date),
      expected_end_date: this.formatDate(raw.expected_end_date),
      storage_conditions: raw.storage_conditions,
      sampling_timepoints: raw.sampling_timepoints.map((t: any) => ({
        ...t,
        planned_date: this.formatDate(t.planned_date),
      })),
    };
    if (mode === 'submit') payload.status = 'pending_approval';

    this.protocol.create(payload).subscribe({
      next: (p: any) => {
        this.message.add({ severity: 'success', summary: mode === 'submit' ? '已提交审批' : '已保存草稿', detail: `方案编号：${p.protocol_code}` });
        setTimeout(() => this.router.navigate(['/protocols', p.id]), 800);
      },
      error: (e) => {
        this.saving.set(false);
        this.message.add({ severity: 'error', summary: '保存失败', detail: e.error?.detail || e.message });
      }
    });
  }
}
