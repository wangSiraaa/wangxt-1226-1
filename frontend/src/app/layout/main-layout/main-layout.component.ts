import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { BadgeModule } from 'primeng/badge';
import { MenuModule } from 'primeng/menu';
import { AuthService } from '../../shared/services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { User, RoleName } from '../../shared/models';
import { filter } from 'rxjs';

interface NavItem {
  label: string; icon: string; route: string; badge?: number;
  roles?: RoleName[]; children?: NavItem[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule, SidebarModule, BadgeModule, MenuModule],
  template: `
    <div class="app-container flex">
      <aside class="w-64 min-h-screen shadow-lg flex flex-col"
        style="background: linear-gradient(180deg, #1e3a5f 0%, #2c5282 100%); color: white;">
        <div class="p-4 border-b border-white/10">
          <div class="flex align-items-center gap-2">
            <span class="text-3xl">🧪</span>
            <div>
              <div class="font-bold text-lg">稳定性试验</div>
              <div class="text-xs text-blue-200">管理平台</div>
            </div>
          </div>
        </div>

        <nav class="flex-1 p-3 space-y-1">
          @for (item of navItems(); track item.route) {
            <a [routerLink]="item.route" routerLinkActive="bg-white/20"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-white/10"
              [ngStyle]="{ opacity: hasAccess(item) ? 1 : 0.4, pointerEvents: hasAccess(item) ? 'auto' : 'none' }">
              <i class="pi {{ item.icon }}" style="width: 1.25rem;"></i>
              <span class="flex-1">{{ item.label }}</span>
              @if (item.badge) {
                <span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{{ item.badge }}</span>
              }
            </a>
          }
        </nav>

        <div class="p-3 border-t border-white/10 text-xs text-blue-200">
          v1.0.0 · © 2024
        </div>
      </aside>

      <main class="flex-1 flex flex-col min-h-screen">
        <header class="flex items-center justify-between px-6 py-3 bg-white shadow-sm border-bottom">
          <div>
            <h2 class="text-lg font-semibold text-gray-800 m-0">{{ currentTitle }}</h2>
            <p class="text-xs text-gray-500 m-0">{{ todayStr }}</p>
          </div>
          <div class="flex items-center gap-4">
            <button pButton icon="pi pi-bell" class="p-button-text p-button-lg relative"
              (click)="toggleNotifications = !toggleNotifications">
              @if (unreadCount() > 0) {
                <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {{ unreadCount() }}
                </span>
              }
            </button>

            <p-menu #userMenu [popup]="true" [model]="userMenuItems" [appendTo]="'body'"></p-menu>
            <div class="flex items-center gap-3 cursor-pointer" (click)="userMenu.toggle($event)">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                {{ currentUser?.full_name?.charAt(0) || '?' }}
              </div>
              <div class="hidden md:block">
                <div class="text-sm font-medium text-gray-800">{{ currentUser?.full_name }}</div>
                <div class="text-xs text-gray-500">{{ rolesLabel }}</div>
              </div>
              <i class="pi pi-chevron-down text-xs text-gray-400"></i>
            </div>
          </div>
        </header>

        <div class="flex-1 p-6 bg-gray-50 overflow-auto">
          @if (toggleNotifications) {
            <div class="absolute right-6 top-20 w-96 bg-white rounded-xl shadow-2xl border z-50">
              <div class="flex justify-between items-center p-4 border-b">
                <div class="font-semibold">🔔 通知中心 ({{ unreadCount() }} 未读)</div>
                <button pButton icon="pi pi-check" class="p-button-text p-button-sm" label="全部已读" (click)="markAllRead()"></button>
              </div>
              <div class="max-h-96 overflow-auto">
                @if (notifications().length === 0) {
                  <div class="p-8 text-center text-gray-400 text-sm">暂无通知</div>
                }
                @for (n of notifications(); track n.id) {
                  <div class="p-4 border-b hover:bg-gray-50 cursor-pointer transition"
                    [ngStyle]="{ background: n.is_read ? '' : '#eff6ff' }"
                    (click)="markRead(n.id)">
                    <div class="flex justify-between items-start mb-1">
                      <div class="font-medium text-sm text-gray-800">{{ n.title }}</div>
                      @if (!n.is_read) { <span class="w-2 h-2 bg-blue-500 rounded-full mt-1"></span> }
                    </div>
                    <div class="text-xs text-gray-600 mb-2 line-clamp-2">{{ n.message }}</div>
                    <div class="text-xs text-gray-400">{{ n.created_at | date:'MM-dd HH:mm' }}</div>
                  </div>
                }
              </div>
            </div>
          }

          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
})
export class MainLayoutComponent implements OnInit {
  currentUser: User | null = null;
  toggleNotifications = false;
  notifications = signal<any[]>([]);
  unreadCount = signal(0);

  todayStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  currentTitle = '仪表盘';

  userMenuItems: MenuItem[] = [];

  private _navItems = signal<NavItem[]>([
    { label: '仪表盘', icon: 'pi-th-large', route: '/dashboard' },
    { label: '试验方案', icon: 'pi-file', route: '/protocols', roles: ['researcher', 'qa', 'admin'] },
    { label: '样品管理', icon: 'pi-box', route: '/samples' },
    { label: '环境监控', icon: 'pi-temperature-high', route: '/environment' },
    { label: '环境警报', icon: 'pi-exclamation-triangle', route: '/environment/alerts', roles: ['qa', 'warehouse', 'admin'] },
    { label: '检测结果', icon: 'pi-list-check', route: '/test-results' },
    { label: '偏差调查', icon: 'pi-search', route: '/deviations', roles: ['qa', 'admin'] },
  ]);
  navItems = this._navItems.asReadonly();

  get rolesLabel(): string {
    const map: Record<string, string> = {
      admin: '管理员', researcher: '研究员', warehouse: '仓管员', qa: 'QA'
    };
    return this.auth.roles.map(r => map[r] || r).join(' / ');
  }

  constructor(
    private auth: AuthService,
    private notif: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.currentTitle = this.getTitleByRoute(e.urlAfterRedirects || e.url);
      this.toggleNotifications = false;
    });
  }

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.userMenuItems = [
      { label: this.currentUser?.full_name || '用户', disabled: true, icon: 'pi-user' },
      { separator: true },
      { label: '退出登录', icon: 'pi-sign-out', command: () => this.auth.logout() }
    ];
    this.refreshNotifications();
    setInterval(() => this.refreshUnread(), 30000);
  }

  hasAccess(item: NavItem): boolean {
    if (!item.roles) return true;
    return this.auth.hasRole(item.roles as RoleName[]);
  }

  getTitleByRoute(url: string): string {
    const map: Record<string, string> = {
      '/dashboard': '仪表盘',
      '/protocols': '试验方案管理',
      '/samples': '样品生命周期管理',
      '/environment': '温湿度监控',
      '/environment/alerts': '环境警报处理',
      '/test-results': '检测结果与审批',
      '/deviations': '偏差调查与CAPA',
    };
    for (const key of Object.keys(map)) {
      if (url.startsWith(key)) return map[key];
    }
    return '稳定性试验平台';
  }

  refreshNotifications() {
    this.refreshUnread();
    this.notif.list({ limit: 20 }).subscribe(list => this.notifications.set(list));
  }

  refreshUnread() {
    this.notif.getUnreadCount().subscribe(c => this.unreadCount.set(c));
  }

  markRead(id: number) {
    this.notif.markRead(id).subscribe(() => {
      this.refreshNotifications();
    });
  }

  markAllRead() {
    this.notif.markAllRead().subscribe(() => this.refreshNotifications());
  }
}
