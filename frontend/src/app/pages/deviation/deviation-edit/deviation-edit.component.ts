import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, ReactiveFormsModule, Validators, FormArray, FormBuilder } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { FieldsetModule } from 'primeng/fieldset';
import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { TabViewModule } from 'primeng/tabview';
import { MessageService } from 'primeng/api';
import { DeviationService } from '../../../shared/services/deviation.service';
import { SampleService } from '../../../shared/services/sample.service';
import { ProtocolService } from '../../../shared/services/protocol.service';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-deviation-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, DropdownModule,
    InputTextModule, InputTextareaModule, CalendarModule, MultiSelectModule, ToastModule, FieldsetModule,
    DividerModule, CheckboxModule, TabViewModule],
  providers: [MessageService, FormBuilder],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <div class="card">
        <div class="flex justify-between items-start flex-wrap gap-4 mb-5">
          <div class="flex items-center gap-3">
            <a routerLink="/deviations" pButton icon="pi pi-arrow-left" class="p-button-text p-button-plain"></a>
            <div>
              <h2 class="page-title m-0">📝 新建偏差调查报告</h2>
              <p class="page-subtitle m-0">描述偏差、指定严重度、关联受影响样品、启动 CAPA 调查流程</p>
            </div>
          </div>
          <div class="flex gap-2">
            <a routerLink="/deviations" pButton label="取消" class="p-button-outlined" icon="pi pi-times"></a>
            <button pButton label="保存偏差报告" icon="pi pi-check-circle" (click)="submit()" style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;" [disabled]="saving()" [loading]="saving()"></button>
          </div>
        </div>

        <div *ngIf="fromTr" class="p-3 mb-5 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          💡 从检测结果 <b>{{ fromTr }}</b> 跳转创建 OOS 偏差，已预填字段
        </div>
        <div *ngIf="fromAlert" class="p-3 mb-5 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-700">
          ⚠️ 从环境警报创建偏差
        </div>
      </div>

      <form [formGroup]="form">
        <div class="card mb-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="md:col-span-2">
              <label class="field-label">偏差标题 <span class="text-red-500">*</span></label>
              <input type="text" pInputText formControlName="title" class="w-full"
                placeholder="一句话概括偏差，如：STB-001温湿度箱温度超上限2小时">
            </div>
            <div>
              <label class="field-label">偏差类别 <span class="text-red-500">*</span></label>
              <p-dropdown formControlName="category" styleClass="w-full"
                [options]="[
                  {label:'🌡️ 温湿度偏差',value:'environment_temperature_humidity'},
                  {label:'🧪 OOS 超标结果',value:'out_of_specification'},
                  {label:'⏰ 取样超窗',value:'sampling_window_violation'},
                  {label:'⚙️ 设备异常',value:'equipment'},
                  {label:'📦 物料异常',value:'material'},
                  {label:'🔬 实验室异常',value:'laboratory'},
                  {label:'👥 人员操作',value:'personnel'},
                  {label:'📋 其他',value:'other'},
                ]" optionLabel="label" optionValue="value" placeholder="选择类别"></p-dropdown>
            </div>
            <div>
              <label class="field-label">严重程度 <span class="text-red-500">*</span></label>
              <p-dropdown formControlName="severity" styleClass="w-full"
                [options]="[
                  {label:'🟢 轻微 (Minor)',value:'minor'},
                  {label:'🟠 主要 (Major)',value:'major'},
                  {label:'🔴 严重 (Critical)',value:'critical'},
                ]" optionLabel="label" optionValue="value" placeholder="选择严重度"></p-dropdown>
            </div>
            <div>
              <label class="field-label">发现/产生日期</label>
              <p-calendar formControlName="discovered_at" showTime [showSeconds]="true" dateFormat="yy-mm-dd" timeFormat="HH:mm:ss" styleClass="w-full"></p-calendar>
            </div>
            <div>
              <label class="field-label">要求完成日期</label>
              <p-calendar formControlName="required_date" dateFormat="yy-mm-dd" styleClass="w-full"></p-calendar>
            </div>
            <div>
              <label class="field-label">发现地点</label>
              <input type="text" pInputText formControlName="location" class="w-full" placeholder="如：QC实验室 / STB-001温箱">
            </div>
            <div>
              <label class="field-label">关联试验方案</label>
              <p-dropdown formControlName="protocol_id" [options]="protocolOpts" optionLabel="label" optionValue="id"
                [filter]="true" [showClear]="true" placeholder="可选" styleClass="w-full"></p-dropdown>
            </div>
            <div class="md:col-span-2">
              <label class="field-label">偏差详细描述 <span class="text-red-500">*</span></label>
              <textarea pInputTextarea formControlName="description" [rows]="4" class="w-full"
                placeholder="详细描述偏差发生的时间、地点、过程、已确认的事实等信息"></textarea>
            </div>
            <div class="md:col-span-2">
              <label class="field-label">已采取的应急措施（Immediate Action）</label>
              <textarea pInputTextarea formControlName="immediate_actions" [rows]="3" class="w-full"
                placeholder="如：已将样品转移至备用温箱、已通知QA、已暂停相关操作等"></textarea>
            </div>
          </div>
        </div>

        <div class="card mb-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="section-title border-none m-0">🧪 选择受影响的样品</h3>
            <span class="text-xs text-gray-500">受影响样品将被自动锁定（仅 QA 可解锁）</span>
          </div>

          <p-multiSelect formControlName="sample_ids" [options]="sampleOpts" optionLabel="label" optionValue="id"
            [filter]="true" [display]="'chip'" [maxSelectedLabels]="6"
            placeholder="选择受影响样品（可多选）" styleClass="w-full" [group]="false">
            <ng-template let-item pTemplate="item">
              <div class="flex justify-between">
                <div>
                  <div><b>{{ item.sample_code || item.label }}</b></div>
                  <div class="text-xs text-gray-500">{{ item.protocol_code || '' }} · {{ item.condition_code || '' }}</div>
                </div>
                <span *ngIf="item.is_locked" class="badge badge-danger text-xs">已锁</span>
              </div>
            </ng-template>
          </p-multiSelect>

          <div *ngIf="form.value.sample_ids?.length" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            ⚠️ 保存时将自动锁定已选中的 <b>{{ form.value.sample_ids.length }}</b> 个样品，需 QA 在关闭偏差后解锁
          </div>
        </div>

        <div class="card">
          <h3 class="section-title mb-3">🔍 调查与 CAPA（可选，后续也可在详情页补充）</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="field-label">根本原因</label>
              <textarea pInputTextarea formControlName="root_cause" [rows]="3" class="w-full"
                placeholder="人/机/料/法/环分析，使用5Why/鱼骨图等"></textarea>
            </div>
            <div>
              <label class="field-label">风险评估</label>
              <textarea pInputTextarea formControlName="risk_assessment" [rows]="3" class="w-full"
                placeholder="评估偏差对产品质量、患者安全、数据完整性的影响"></textarea>
            </div>
            <div>
              <label class="field-label">纠正措施</label>
              <textarea pInputTextarea formControlName="corrective_actions" [rows]="3" class="w-full"
                placeholder="为消除本次偏差已采取的直接措施"></textarea>
            </div>
            <div>
              <label class="field-label">预防措施（Preventive）</label>
              <textarea pInputTextarea formControlName="preventive_actions" [rows]="3" class="w-full"
                placeholder="避免类似偏差再次发生的措施"></textarea>
            </div>
          </div>
        </div>
      </form>
    </div>
  `
})
export class DeviationEditComponent implements OnInit {
  saving = signal(false);
  samples = signal<any[]>([]);
  protocols = signal<any[]>([]);
  sampleOpts: any[] = [];
  protocolOpts: any[] = [];
  fromTr: string | null = null;
  fromAlert: number | null = null;

  form: FormGroup;

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private svc: DeviationService,
    private sampleSvc: SampleService,
    private protocolSvc: ProtocolService,
    private message: MessageService,
  ) {
    const today = new Date();
    const required = new Date(); required.setDate(required.getDate() + 21);

    this.form = this.fb.group({
      title: ['', Validators.required],
      category: ['', Validators.required],
      severity: ['minor', Validators.required],
      description: ['', Validators.required],
      discovered_at: [today],
      required_date: [required],
      location: [''],
      protocol_id: [null],
      immediate_actions: [''],
      root_cause: [''],
      risk_assessment: [''],
      corrective_actions: [''],
      preventive_actions: [''],
      sample_ids: [[]],
      status: ['reported'],
    });
  }

  ngOnInit(): void {
    const q = this.route.snapshot.queryParams;
    this.fromTr = q['code'] || null;
    if (q['tr']) {
      this.form.patchValue({ category: 'out_of_specification', title: `检测结果 OOS 偏差 - ${q['code'] || ''}` });
    }
    if (q['alert']) {
      this.fromAlert = Number(q['alert']);
      this.form.patchValue({ category: 'environment_temperature_humidity' });
    }

    this.protocolSvc.list({ limit: 500 }).subscribe(list => {
      this.protocols.set(list);
      this.protocolOpts = list.map(p => ({ ...p, label: `${p.protocol_code} · ${p.product_name} / ${p.batch_number}` }));
    });

    this.sampleSvc.list({ limit: 1000 }).subscribe(list => {
      this.samples.set(list);
      this.sampleOpts = list.filter(s => !['destroyed'].includes(s.status)).map(s => ({
        ...s,
        label: `${s.sample_code} · ${s.protocol_code || ''} ${s.condition_code || ''} (${s.status})`,
      }));
    });
  }

  fmtDateTime(d: any): string {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
  }
  fmtDate(d: any): string {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
  }

  submit() {
    if (!this.form.valid) return;
    this.saving.set(true);
    const v: any = this.form.value;
    const payload: any = {
      ...v,
      discovered_at: this.fmtDateTime(v.discovered_at),
      required_date: v.required_date ? this.fmtDate(v.required_date) : undefined,
      affected_samples: v.sample_ids.map((sid: number) => ({ sample_id: sid })),
    };
    delete payload.sample_ids;

    this.svc.create(payload).subscribe({
      next: (d: any) => {
        this.message.add({ severity: 'success', summary: '偏差报告已创建', detail: d.deviation_code || `DEV#${d.id}` });
        setTimeout(() => this.router.navigate(['/deviations', d.id]), 600);
      },
      error: (e) => { this.saving.set(false);
        this.message.add({ severity: 'error', summary: '保存失败', detail: e.error?.detail }) }
    });
  }
}
