import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { ProtocolService } from '../../../shared/services/protocol.service';
import { AuthService } from '../../../shared/services/auth.service';
import { SamplingCalendarEvent, Protocol } from '../../../shared/models';

interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: SamplingCalendarEvent[];
}

@Component({
  selector: 'app-sampling-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, CardModule, TagModule, TooltipModule, DialogModule, TableModule, DropdownModule],
  template: `
    <div class="space-y-6">
      <div class="card">
        <div class="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 class="text-2xl font-bold text-gray-800 m-0">📅 取样窗口日历</h2>
            <p class="text-sm text-gray-500 mt-1 mb-0">查看各方案的取样时间窗口，快速进入取样操作</p>
          </div>
          <div class="flex gap-2 items-center flex-wrap">
            <p-dropdown [options]="protocolOptions" [(ngModel)]="filterProtocolId" optionLabel="label" optionValue="value"
              placeholder="全部方案" [showClear]="true" [filter]="true" styleClass="w-64" (onChange)="reload()"></p-dropdown>
            <div class="flex gap-1">
              <button pButton icon="pi pi-chevron-left" class="p-button-outlined" (click)="prevMonth()"></button>
              <button pButton label="今天" class="p-button-outlined" (click)="goToday()"></button>
              <button pButton icon="pi pi-chevron-right" class="p-button-outlined" (click)="nextMonth()"></button>
            </div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-4 text-sm">
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>即将开放</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-100 border border-green-300"></span>窗口内</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>紧急</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-gray-100 border border-gray-300"></span>已完成</span>
        </div>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="text-center py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <h3 class="text-xl font-semibold text-gray-700 m-0">{{ monthLabel }}</h3>
        </div>

        <div class="grid grid-cols-7 text-center">
          @for (wd of weekDays; track wd) {
            <div class="py-2 font-semibold text-gray-600 text-sm border-b bg-gray-50">{{ wd }}</div>
          }
        </div>

        <div class="grid grid-cols-7">
          @for (day of calendarDays(); track day.dateStr) {
            <div class="border-b border-r min-h-[120px] p-1.5 transition cursor-pointer hover:bg-gray-50"
              [ngClass]="{
                'bg-gray-50/50': !day.isCurrentMonth,
                'bg-blue-50/30': day.isToday,
              }"
              (click)="selectDay(day)">
              <div class="flex justify-between items-center">
                <span class="text-sm font-medium"
                  [ngClass]="day.isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-700'">
                  {{ day.date.getDate() }}
                </span>
                @if (day.events.length > 0) {
                  <span class="text-xs text-gray-400">{{ day.events.length }}</span>
                }
              </div>
              <div class="mt-1 space-y-1">
                @for (ev of day.events.slice(0, 3); track ev.id) {
                  <div class="text-xs p-1 rounded truncate cursor-pointer"
                    [ngClass]="eventClass(ev)"
                    [pTooltip]="tooltipText(ev)"
                    tooltipPosition="top"
                    (click)="openEventDetail(ev, $event)">
                    <b>{{ ev.protocol_code }}</b> · {{ ev.timepoint_label }}
                  </div>
                }
                @if (day.events.length > 3) {
                  <div class="text-xs text-gray-500 px-1">+{{ day.events.length - 3 }} 更多</div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <p-dialog header="取样窗口详情" [(visible)]="showDetail" [modal]="true" [style]="{ width: '680px' }">
        @if (selectedEvent) {
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <div class="text-xs text-gray-500">方案编号</div>
                <a [routerLink]="['/protocols', selectedEvent.protocol_id]" class="font-semibold text-blue-600 hover:underline">
                  {{ selectedEvent.protocol_code }}
                </a>
              </div>
              <div>
                <div class="text-xs text-gray-500">时间点</div>
                <div class="font-semibold">{{ selectedEvent.timepoint_label }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">计划日期</div>
                <div class="font-semibold">{{ selectedEvent.planned_date }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">状态</div>
                <p-tag [value]="statusLabel(selectedEvent.status)" [severity]="statusSeverity(selectedEvent.status)"></p-tag>
              </div>
              <div>
                <div class="text-xs text-gray-500">窗口开始</div>
                <div>{{ selectedEvent.window_start }}</div>
              </div>
              <div>
                <div class="text-xs text-gray-500">窗口结束</div>
                <div>{{ selectedEvent.window_end }}</div>
              </div>
              <div class="col-span-2">
                <div class="text-xs text-gray-500">取样进度</div>
                <div class="font-semibold">{{ selectedEvent.sample_count_sampled }} / {{ selectedEvent.sample_count_total }}</div>
              </div>
            </div>

            <div>
              <div class="text-xs text-gray-500 mb-1">储存条件</div>
              <div class="flex flex-wrap gap-2">
                @for (c of selectedEvent.storage_conditions; track c.id) {
                  <p-tag [value]="c.code + ' - ' + c.name" severity="info"></p-tag>
                }
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t">
              <button pButton label="查看方案详情" icon="pi pi-external-link" styleClass="p-button-outlined"
                [routerLink]="['/protocols', selectedEvent.protocol_id]"></button>
              <button *ngIf="selectedEvent.can_sample_now && auth.hasRole(['warehouse', 'researcher', 'admin'])"
                pButton label="进入取样" icon="pi pi-sign-out"
                (click)="goToSampling()"></button>
            </div>

            @if (selectedEvent.can_sample_now) {
              <div>
                <div class="text-xs text-gray-500 mb-2">可取样样品列表（点击进入取样）</div>
                <p-table [value]="availableSamples()" [size]="'small'" responsiveLayout="scroll">
                  <ng-template pTemplate="header">
                    <tr>
                      <th>样品编号</th><th>条件</th><th>位置</th><th>状态</th><th>操作</th>
                    </tr>
                  </ng-template>
                  <ng-template pTemplate="body" let-s>
                    <tr>
                      <td><b>{{ s.sample_code }}</b></td>
                      <td>{{ s.condition_code }}</td>
                      <td>{{ s.chamber_position || s.location }}</td>
                      <td>
                        <span *ngIf="s.is_locked" class="badge badge-danger">🔒 锁定</span>
                        <span *ngIf="!s.is_locked && s.can_sample_now" class="badge badge-success">可取样</span>
                        <span *ngIf="!s.is_locked && !s.can_sample_now" class="badge badge-warning">窗口外</span>
                      </td>
                      <td>
                        <a *ngIf="s.can_sample_now && !s.is_locked"
                          [routerLink]="['/samples', s.sample_id, 'sampling']"
                          pButton label="取样" icon="pi pi-sign-out" class="p-button-sm p-button-success"></a>
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              </div>
            }
          </div>
        }
      </p-dialog>
    </div>
  `
})
export class SamplingCalendarComponent implements OnInit {
  currentMonth = signal(new Date());
  events = signal<SamplingCalendarEvent[]>([]);
  showDetail = false;
  selectedEvent: SamplingCalendarEvent | null = null;
  availableSamples = signal<any[]>([]);
  filterProtocolId: number | null = null;
  protocolOptions: { label: string; value: number | null }[] = [];

  weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  calendarDays = computed<CalendarDay[]>(() => {
    const year = this.currentMonth().getFullYear();
    const month = this.currentMonth().getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];
    const today = new Date();
    const todayStr = this.fmtDate(today);

    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push(this.buildDay(d, false, todayStr));
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push(this.buildDay(d, true, todayStr));
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push(this.buildDay(d, false, todayStr));
    }
    return days;
  });

  monthLabel = computed(() => {
    const d = this.currentMonth();
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
  });

  constructor(
    public auth: AuthService,
    private router: Router,
    private protocolSvc: ProtocolService,
  ) {}

  ngOnInit(): void {
    this.loadProtocols();
    this.loadEvents();
  }

  loadProtocols() {
    this.protocolSvc.list({ limit: 500 }).subscribe(list => {
      this.protocolOptions = [
        ...list.map(p => ({ label: `${p.protocol_code} - ${p.title}`, value: p.id }))
      ];
    });
  }

  reload() {
    this.loadEvents();
  }

  loadEvents() {
    const cur = this.currentMonth();
    const start = new Date(cur.getFullYear(), cur.getMonth(), -7);
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 14);
    this.protocolSvc.getSamplingCalendar({
      start_date: this.fmtDate(start),
      end_date: this.fmtDate(end),
      protocol_id: this.filterProtocolId ?? undefined,
    }).subscribe(list => this.events.set(list));
  }

  buildDay(d: Date, isCurrentMonth: boolean, todayStr: string): CalendarDay {
    const dateStr = this.fmtDate(d);
    const dayEvents = this.events().filter(e => {
      return e.window_start <= dateStr && e.window_end >= dateStr;
    });
    return {
      date: d,
      dateStr,
      isCurrentMonth,
      isToday: dateStr === todayStr,
      events: dayEvents,
    };
  }

  fmtDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  prevMonth() {
    const cur = this.currentMonth();
    this.currentMonth.set(new Date(cur.getFullYear(), cur.getMonth() - 1, 1));
    this.loadEvents();
  }

  nextMonth() {
    const cur = this.currentMonth();
    this.currentMonth.set(new Date(cur.getFullYear(), cur.getMonth() + 1, 1));
    this.loadEvents();
  }

  goToday() {
    this.currentMonth.set(new Date());
    this.loadEvents();
  }

  selectDay(day: CalendarDay) {
    if (day.events.length > 0) {
      this.openEventDetail(day.events[0]);
    }
  }

  openEventDetail(ev: SamplingCalendarEvent, e?: Event) {
    if (e) e.stopPropagation();
    this.selectedEvent = ev;
    this.showDetail = true;
    this.availableSamples.set([]);
    if (ev.can_sample_now) {
      this.protocolSvc.getTimepointAvailableSamples(ev.timepoint_id).subscribe(list => {
        this.availableSamples.set(list);
      });
    }
  }

  eventClass(ev: SamplingCalendarEvent): string {
    switch (ev.status) {
      case 'in_window': return 'bg-green-100 text-green-800 border border-green-200';
      case 'urgent': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'completed': return 'bg-gray-100 text-gray-600 border border-gray-200';
      default: return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
  }

  statusLabel(s: string): string {
    return { upcoming: '即将开放', in_window: '窗口内', urgent: '紧急', completed: '已完成' }[s] || s;
  }

  statusSeverity(s: string): 'success' | 'warning' | 'info' | 'secondary' | 'danger' {
    return { in_window: 'success', urgent: 'warning', upcoming: 'info', completed: 'secondary' }[s] || 'info';
  }

  tooltipText(ev: SamplingCalendarEvent): string {
    return `${ev.protocol_code} ${ev.timepoint_label}\n计划: ${ev.planned_date}\n窗口: ${ev.window_start} ~ ${ev.window_end}\n进度: ${ev.sample_count_sampled}/${ev.sample_count_total}`;
  }

  goToSampling() {
    if (!this.selectedEvent) return;
    this.router.navigate(['/samples'], {
      queryParams: { protocol: this.selectedEvent.protocol_id, tp: this.selectedEvent.timepoint_id }
    });
  }
}
