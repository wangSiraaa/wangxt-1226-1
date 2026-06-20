import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../shared/services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ButtonModule, InputTextModule, CardModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="flex align-items-center justify-content-center min-h-screen" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div class="w-full" style="max-width: 420px; padding: 1rem;">
        <p-toast></p-toast>
        <p-card>
          <div class="text-center mb-5">
            <div class="text-4xl mb-3" style="color: #667eea;">🧪</div>
            <h1 class="text-2xl font-bold mb-1 text-gray-800">稳定性试验管理系统</h1>
            <p class="text-gray-500 text-sm">Pharmaceutical Stability Study Platform</p>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <div class="field mb-4">
              <label class="block text-sm font-medium mb-2 text-gray-700">用户名</label>
              <input type="text" pInputText formControlName="username"
                class="w-full" placeholder="admin / researcher1 / warehouse1 / qa1"
                [disabled]="loading" autocomplete="username">
            </div>
            <div class="field mb-5">
              <label class="block text-sm font-medium mb-2 text-gray-700">密码</label>
              <input type="password" pInputText formControlName="password"
                class="w-full" placeholder="admin123 / pass1234"
                [disabled]="loading" autocomplete="current-password">
            </div>

            <button type="submit" pButton label="登 录" class="w-full mb-3"
              style="background: linear-gradient(135deg, #667eea, #764ba2); border: none;"
              [loading]="loading" [disabled]="!loginForm.valid">
            </button>

            <button type="button" pButton label="初始化演示账号" class="w-full"
              styleClass="p-button-outlined" [disabled]="loading"
              (click)="initDefaultUsers()">
            </button>
          </form>

          <div class="mt-5 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <div class="font-semibold mb-2 text-gray-600">📝 测试账号：</div>
            <div class="space-y-1">
              <div>• <b>admin</b> / admin123 (超级管理员 - 全部权限)</div>
              <div>• <b>researcher1</b> / pass1234 (研究员 - 创建方案/检测)</div>
              <div>• <b>warehouse1</b> / pass1234 (仓管员 - 入箱/取样)</div>
              <div>• <b>qa1</b> / pass1234 (QA - 偏差/审批)</div>
            </div>
          </div>
        </p-card>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  loginForm = new FormGroup({
    username: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
  });
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private message: MessageService,
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) this.router.navigate(['/dashboard']);
  }

  onSubmit() {
    if (!this.loginForm.valid) return;
    const { username, password } = this.loginForm.value;
    if (!username || !password) return;

    this.loading = true;
    this.auth.login(username, password)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: () => this.message.add({
          severity: 'error', summary: '登录失败',
          detail: '用户名或密码错误'
        })
      });
  }

  initDefaultUsers() {
    this.loading = true;
    this.auth.registerDefaultUsers()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (res: any) => this.message.add({
          severity: 'success', summary: '初始化成功',
          detail: `已创建账号: ${res.created_users?.join(', ') || '已存在'}`
        }),
        error: (err) => this.message.add({
          severity: 'warn', summary: '提示',
          detail: err.error?.detail || '请先启动后端服务'
        })
      });
  }
}
