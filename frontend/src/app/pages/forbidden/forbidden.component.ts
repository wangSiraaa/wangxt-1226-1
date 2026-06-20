import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonModule],
  template: `
    <div class="flex flex-col align-items-center justify-content-center min-h-screen bg-gray-50">
      <div class="text-8xl mb-4">🚫</div>
      <h1 class="text-4xl font-bold mb-2 text-gray-800">403 权限不足</h1>
      <p class="text-gray-500 mb-6">您没有访问此页面的权限</p>
      <button pButton label="返回首页" icon="pi pi-home" routerLink="/dashboard"></button>
    </div>
  `
})
export class ForbiddenComponent {}
