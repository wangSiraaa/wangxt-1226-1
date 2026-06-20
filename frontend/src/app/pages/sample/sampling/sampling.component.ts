import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import { SampleService } from '../../../shared/services/sample.service';
import { ProtocolService } from '../../../shared/services/protocol.service';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-sampling',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ButtonModule, CardModule, DropdownModule,
    InputTextModule, InputTextareaModule, InputNumberModule, CalendarModule, ToastModule, TagModule, ProgressBarModule],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <div class="card">
        <div class="page-header flex-wrap">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <a routerLink="/samples" pButton icon="pi pi-arrow-left" class="p-button-text p-button-plain"></a>
              <h2 class="page-title m-0">🧪 取样操作 - {{ sample()?.sample_code || '加载中...' }}</h2>
            </div>
            <p class="page-subtitle m-0">请严格按照取样时间窗口执行取样操作，确保合规</p>
          </div>
          <a *ngIf="sample()" [routerLink]="['/samples', id]" pButton label="样品详情" icon="pi pi-external-link" class="p-button-outlined"></a>
        </div>
      </div>

      @if (loading()) {
        <div class="text-center py-20"><i class="pi pi-spin pi-spinner text-3xl text-gray-400"></i></div>
      } @else if (!sample()) {
        <div class="card text-center py-16 text-gray-500">样品不存在</div>
      } @else {
        @if (sample()!.is_locked) {
          <div class="card border-2 border-red-300 bg-red-50">
            <div class="flex items-start gap-4">
              <div class="text-6xl text-red-500">🔒</div>
              <div>
                <h3 class="text-xl font-bold text-red-700 mb-2">样品已被锁定，无法取样</h3>
                <p class="text-gray-700">
                  锁定原因：<b>{{ sample()!.lock_reason || '未说明' }}</b><br>
                  需联系 QA 管理员（角色：qa）解锁后才能执行取样操作。
                </p>
                <a routerLink="/samples" class="mt-3 inline-block">
                  <button pButton label="返回样品列表" icon="pi pi-arrow-left"></button>
                </a>
              </div>
            </div>
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 space-y-6">
              <div class="card" [ngClass]="windowCheck()?.can_sample_now ? 'border-green-300' : windowCheck()?.error ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'">
                <h3 class="section-title mb-4">⏱️ 取样时间窗口校验</h3>

                <div *ngIf="!selectedTp" class="p-4 bg-blue-50 rounded-lg">
                  <i class="pi pi-info-circle text-blue-500 mr-2"></i>
                  请在右侧选择本次取样对应的<b>时间点</b>
                </div>

                <div *ngIf="windowCheck()?.error" class="p-4 rounded-lg" style="background: #fef2f2;">
                  <div class="flex items-start gap-3">
                    <div class="text-4xl">❌</div>
                    <div>
                      <h4 class="font-bold text-red-700 mb-1">不符合取样条件</h4>
                      <div class="text-red-600 text-sm mb-3"><b>{{ windowCheck()!.error }}</b></div>
                      @if (windowCheck()?.can_sample_after_date) {
                        <div class="text-xs text-gray-600 bg-white p-2 rounded">
                          🔜 最早可取样日期：<b class="text-red-600">{{ windowCheck()!.can_sample_after_date }}</b>
                          （剩余 <b>{{ windowCheck()!.days_until_window_start || '?' }}</b> 天）
                        </div>
                      }
                      @if (windowCheck()?.window_closed) {
                        <div class="text-xs text-gray-600 bg-white p-2 rounded mt-2">
                          📌 该取样窗口已于 <b class="text-red-600">{{ windowCheck()?.window_end }}</b> 关闭，需走偏差调查流程后才能取样
                        </div>
                      }
                    </div>
                  </div>
                </div>

                <div *ngIf="!windowCheck()?.error && windowCheck()">
                  <div class="flex items-start gap-4 mb-4">
                    <div class="text-4xl" [ngClass]="windowCheck()?.is_urgent ? 'text-orange-500' : 'text-green-500'">
                      {{ windowCheck()?.is_urgent ? '⚠️' : '✅' }}
                    </div>
                    <div class="flex-1">
                      <h4 class="font-bold" [ngClass]="windowCheck()?.is_urgent ? 'text-orange-700' : 'text-green-700'">
                        {{ windowCheck()?.is_urgent ? '取样窗口即将关闭，请尽快取样！' : '可以执行取样' }}
                      </h4>
                      <div class="grid-3 gap-3 mt-3">
                        <div class="p-3 bg-gray-50 rounded">
                          <div class="text-xs text-gray-500">计划日期</div>
                          <div class="font-semibold">{{ windowCheck()?.planned_date }}</div>
                        </div>
                        <div class="p-3 bg-gray-50 rounded">
                          <div class="text-xs text-gray-500">窗口开始</div>
                          <div class="font-semibold text-blue-600">{{ windowCheck()?.window_start }}</div>
                        </div>
                        <div class="p-3 bg-gray-50 rounded">
                          <div class="text-xs text-gray-500">窗口结束</div>
                          <div class="font-semibold text-purple-600">{{ windowCheck()?.window_end }}</div>
                        </div>
                      </div>
                      <p-progressBar [value]="windowProgress()" class="mt-4"
                        [ngClass]="windowCheck()?.is_urgent ? 'p-progressbar-warning' : 'p-progressbar-success'"
                        [style]="{ height: '10px' }"></p-progressBar>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card">
                <h3 class="section-title mb-4">📝 填写取样记录</h3>
                <form [formGroup]="form" class="space-y-5">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="field-label">取样时间点 <span class="text-red-500">*</span></label>
                      <p-dropdown formControlName="timepoint_id" [options]="tpOptions"
                        optionLabel="label" optionValue="id" placeholder="选择时间点" styleClass="w-full"
                        [filter]="true">
                        <ng-template let-item pTemplate="item">
                          <div class="flex justify-between">
                            <span><b>{{ item.label }}</b></span>
                            <span class="text-xs text-gray-500">{{ item.planned_date }}</span>
                          </div>
                        </ng-template>
                      </p-dropdown>
                    </div>
                    <div>
                      <label class="field-label">取样日期时间 <span class="text-red-500">*</span></label>
                      <p-calendar formControlName="sampled_at" showTime [showSeconds]="true"
                        dateFormat="yy-mm-dd" timeFormat="HH:mm:ss" styleClass="w-full"></p-calendar>
                    </div>
                    <div>
                      <label class="field-label">取样数量 <span class="text-red-500">*</span></label>
                      <div class="flex gap-2">
                        <p-inputNumber formControlName="sampled_quantity" [min]="0.01" [step]="0.1" mode="decimal" styleClass="flex-1"></p-inputNumber>
                        <input type="text" pInputText formControlName="unit" placeholder="单位" style="width: 100px;">
                      </div>
                    </div>
                    <div>
                      <label class="field-label">取样环境温度(℃)</label>
                      <p-inputNumber formControlName="environment_temp" mode="decimal" [minFractionDigits]="1" class="w-full"></p-inputNumber>
                    </div>
                    <div>
                      <label class="field-label">出箱时间 <span class="text-red-500">*</span></label>
                      <p-calendar formControlName="out_chamber_time" showTime [showSeconds]="true"
                        dateFormat="yy-mm-dd" timeFormat="HH:mm:ss" styleClass="w-full"></p-calendar>
                    </div>
                    <div>
                      <label class="field-label">归位时间</label>
                      <p-calendar formControlName="return_chamber_time" showTime [showSeconds]="true"
                        dateFormat="yy-mm-dd" timeFormat="HH:mm:ss" styleClass="w-full"></p-calendar>
                    </div>
                  </div>

                  <div>
                    <label class="field-label">取样备注</label>
                    <textarea pInputTextarea formControlName="remarks" [rows]="3" class="w-full"
                      placeholder="如：异常情况说明、样品外观描述、取样人等"></textarea>
                  </div>

                  <div *ngIf="windowCheck()?.is_within_window === false" class="p-4 rounded-lg" style="background: #fffbeb;">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">⚠️</span>
                      <div class="text-sm text-amber-800 flex-1">
                        <b>本次取样将超出允许窗口！</b>系统将自动：
                        <ul class="list-disc list-inside mt-1 space-y-0.5">
                          <li>记录本次取样超出窗口的事实（is_within_window=false）</li>
                          <li>自动通知 QA 部门（发送系统通知+邮件）</li>
                          <li>检测结果可能需要启动 OOS/OOT 偏差调查流程</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div class="flex justify-end gap-3 pt-4 border-t">
                    <a [routerLink]="['/samples', id]" pButton label="取消" styleClass="p-button-outlined"></a>
                    <button pButton label="保存取样记录并创建检测" icon="pi pi-check"
                      [disabled]="!form.valid || !!windowCheck()?.error || submitting()"
                      [loading]="submitting()"
                      style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;"
                      (click)="submitSampling()">
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div class="space-y-6">
              <div class="card">
                <h3 class="section-title mb-3">📦 样品信息</h3>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between py-2 border-b"><span class="text-gray-500">样品编号</span><b>{{ sample()!.sample_code }}</b></div>
                  <div class="flex justify-between py-2 border-b"><span class="text-gray-500">所属方案</span><b class="text-blue-600">{{ sample()!.protocol_code }}</b></div>
                  <div class="flex justify-between py-2 border-b"><span class="text-gray-500">产品</span>{{ sample()!.product_name }}</div>
                  <div class="flex justify-between py-2 border-b"><span class="text-gray-500">批次号</span>{{ sample()!.batch_number }}</div>
                  <div class="flex justify-between py-2 border-b"><span class="text-gray-500">储存条件</span>
                    <p-tag [value]="sample()!.condition_code" severity="info"></p-tag>
                  </div>
                  <div class="flex justify-between py-2 border-b"><span class="text-gray-500">位置</span>{{ sample()!.chamber_position || '-' }}</div>
                  <div class="flex justify-between py-2 border-b"><span class="text-gray-500">可用数量</span><b class="text-green-600">{{ sample()!.remaining_quantity || sample()!.quantity }} {{ sample()!.unit || '单位' }}</b></div>
                  <div class="flex justify-between py-2"><span class="text-gray-500">状态</span>
                    <span class="badge" [ngClass]="statusClass(sample()!.status)">{{ statusLabel(sample()!.status) }}</span>
                  </div>
                </div>
              </div>

              <div class="card">
                <h3 class="section-title mb-3">📋 取样时间点</h3>
                <div class="space-y-2">
                  @for (t of timepoints(); track t.id) {
                    <div class="p-3 rounded-lg border transition cursor-pointer"
                      [ngClass]="{
                        'border-2 border-blue-400 bg-blue-50': selectedTp?.id === t.id,
                        'border-red-300 bg-red-50': t.is_passed && !t.is_sampled,
                        'border-green-300 bg-green-50': t.is_sampled
                      }"
                      (click)="selectTp(t)">
                      <div class="flex items-center justify-between mb-1">
                        <b>{{ t.timepoint_label }}</b>
                        <span *ngIf="t.is_sampled" class="text-xs text-green-600">✅ 已取</span>
                        <span *ngIf="t.is_passed && !t.is_sampled" class="text-xs text-red-600">⏰ 逾期</span>
                        <span *ngIf="t.is_now" class="text-xs text-blue-600">🔲 窗口内</span>
                      </div>
                      <div class="text-xs text-gray-500 flex justify-between">
                        <span>{{ t.planned_date }}</span>
                        <span>±{{ t.window_before_days || 0 }}/+{{ t.window_after_days || 0 }}天</span>
                      </div>
                    </div>
                  } @empty {
                    <div class="text-center py-4 text-gray-400 text-sm">该方案暂无时间点</div>
                  }
                </div>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `
})
export class SamplingComponent implements OnInit {
  id = Number(this.route.snapshot.params['id']);
  loading = signal(true);
  submitting = signal(false);
  sample = signal<any>(null);
  timepoints = signal<any[]>([]);
  tpOptions: any[] = [];
  windowCheck = signal<any>(null);
  selectedTp: any = null;

  form = new FormGroup({
    timepoint_id: new FormControl<number | null>(null, Validators.required),
    sampled_at: new FormControl<Date>(new Date(), Validators.required),
    sampled_quantity: new FormControl<number>(1, Validators.required),
    unit: new FormControl('单位'),
    environment_temp: new FormControl<number | null>(null),
    out_chamber_time: new FormControl<Date>(new Date(), Validators.required),
    return_chamber_time: new FormControl<Date | null>(null),
    remarks: new FormControl(''),
  });

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private sampleSvc: SampleService,
    private protocolSvc: ProtocolService,
    private message: MessageService,
  ) {
    this.form.get('timepoint_id')?.valueChanges.subscribe(id => {
      if (id) this.checkWindow(Number(id));
    });
  }

  ngOnInit(): void {
    this.sampleSvc.get(this.id).subscribe({
      next: (s) => {
        this.sample.set(s);
        if (s.protocol_id) this.loadTimepoints(Number(s.protocol_id));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async loadTimepoints(pid: number) {
    const tps = await new Promise<any[]>((resolve, reject) => {
      this.protocolSvc.getTimepoints(pid).subscribe({
        next: resolve, error: () => resolve([])
      });
    });
    const today = new Date();
    const enriched = tps.map(t => {
      const start = this.addDays(t.planned_date, -(t.window_before_days || 0));
      const end = this.addDays(t.planned_date, t.window_after_days || 0);
      return {
        ...t,
        label: `${t.timepoint_label} · ${t.planned_date}`,
        is_now: today >= start && today <= end,
        is_passed: today > end,
      };
    });
    this.timepoints.set(enriched);
    this.tpOptions = enriched;
    const matchTp = enriched.find(t => t.is_now) || enriched[0];
    if (matchTp) {
      this.selectedTp = matchTp;
      this.form.patchValue({ timepoint_id: matchTp.id });
    }
  }

  selectTp(t: any) {
    this.selectedTp = t;
    this.form.patchValue({ timepoint_id: t.id });
  }

  async checkWindow(tpId: number) {
    const protocolId = this.sample()?.protocol_id;
    if (!protocolId) return;
    try {
      const info = await new Promise<any>((resolve, reject) => {
        this.sampleSvc.checkSamplingWindow(this.id, tpId).subscribe({ next: resolve, error: reject });
      });
      this.windowCheck.set(info);
    } catch (e: any) {
      this.windowCheck.set({
        error: e.error?.detail || e.message || '校验失败',
        can_sample_now: false,
      });
    }
  }

  windowProgress(): number {
    const wc = this.windowCheck();
    if (!wc) return 0;
    if (wc.can_sample_after_date) {
      const d = wc.days_until_window_start || 0;
      return Math.max(5, Math.min(90, 50 - d * 5));
    }
    return 50 + Math.random() * 40;
  }

  addDays(dateStr: string, days: number): Date {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d;
  }

  fmt(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  submitSampling() {
    if (!this.form.valid || this.windowCheck()?.error) return;
    this.submitting.set(true);
    const v: any = this.form.value;
    const payload = {
      sample_id: this.id,
      timepoint_id: v.timepoint_id,
      sampled_at: this.fmt(new Date(v.sampled_at)),
      sampled_quantity: v.sampled_quantity,
      out_chamber_time: this.fmt(new Date(v.out_chamber_time)),
      return_chamber_time: v.return_chamber_time ? this.fmt(new Date(v.return_chamber_time)) : undefined,
      total_exposure_minutes: v.return_chamber_time
        ? Math.max(1, Math.round((new Date(v.return_chamber_time).getTime() - new Date(v.out_chamber_time).getTime()) / 60000))
        : undefined,
      remarks: v.remarks,
    };
    this.sampleSvc.createSamplingRecord(payload).subscribe({
      next: (res: any) => {
        this.message.add({ severity: 'success', summary: '取样完成', detail: `记录编号: #${res.id}` });
        this.submitting.set(false);
        setTimeout(() => this.router.navigate(['/test-results/new'], { queryParams: { sample: this.id, sr: res.id, tp: v.timepoint_id } }), 600);
      },
      error: (e) => {
        this.submitting.set(false);
        this.message.add({ severity: 'error', summary: '失败', detail: e.error?.detail });
      }
    });
  }

  statusClass(s: string): string {
    return { generated:'badge-secondary', in_storage:'badge-success', out_for_sampling:'badge-info',
      sampled:'badge-primary', returned:'badge-info', destroyed:'badge-dark' }[s] || 'badge';
  }
  statusLabel(s: string): string {
    return { generated:'已生成', in_storage:'在储存', out_for_sampling:'取样中',
      sampled:'已取样', returned:'已归还', destroyed:'已销毁' }[s] || s;
  }
}
