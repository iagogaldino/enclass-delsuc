import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>Configurações</h2>
    <mat-dialog-content>
      <mat-nav-list>
        <a mat-list-item (click)="data.generateHTML(); $event.preventDefault()" 
           [class.disabled]="data.generatingHTML || data.generatingAudio || data.loadingScreenshot" 
           class="modal-button" href="#">
          @if (data.generatingHTML) {
            <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
          } @else {
            <mat-icon matListItemIcon>code</mat-icon>
          }
          <span matListItemTitle>Gerar HTML</span>
        </a>
        <a mat-list-item (click)="data.generateAudio(); $event.preventDefault()" 
           [class.disabled]="data.generatingAudio || data.generatingHTML || data.generatingExercises || data.loadingScreenshot" 
           class="modal-button" href="#">
          @if (data.generatingAudio) {
            <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
          } @else {
            <mat-icon matListItemIcon>volume_up</mat-icon>
          }
          <span matListItemTitle>Explicação em Áudio</span>
        </a>
        <a mat-list-item (click)="data.generateExercises(); $event.preventDefault()" 
           [class.disabled]="data.generatingExercises || data.generatingHTML || data.generatingAudio || data.loadingScreenshot" 
           class="modal-button" href="#">
          @if (data.generatingExercises) {
            <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
          } @else {
            <mat-icon matListItemIcon>quiz</mat-icon>
          }
          <span matListItemTitle>Gerar Exercício</span>
        </a>
        <a mat-list-item (click)="data.downloadLRC(); $event.preventDefault()" 
           [class.disabled]="data.loadingScreenshot || data.generatingAudio" 
           class="modal-button" href="#">
          @if (data.generatingAudio) {
            <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
          } @else {
            <mat-icon matListItemIcon>download</mat-icon>
          }
          <span matListItemTitle>Baixar LRC</span>
        </a>
        <a mat-list-item (click)="data.reload(); $event.preventDefault()" 
           [class.disabled]="data.generatingHTML || data.generatingAudio || data.generatingExercises || data.loadingScreenshot" 
           class="modal-button" href="#">
          <mat-icon matListItemIcon>refresh</mat-icon>
          <span matListItemTitle>Recarregar</span>
        </a>
      </mat-nav-list>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="closeDialog()">Fechar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      padding: 0 !important;
    }

    mat-nav-list {
      padding: 0;
    }

    .modal-button {
      cursor: pointer;
      transition: all 0.2s;
      color: rgba(0, 0, 0, 0.87);
      text-decoration: none;
      display: block;

      &:hover:not(.disabled) {
        background-color: rgba(0, 0, 0, 0.04);
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      ::ng-deep {
        .mat-list-item-content {
          padding: 0 16px !important;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        mat-icon[matListItemIcon] {
          margin-right: 0;
          color: rgba(0, 0, 0, 0.54);
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        span[matListItemTitle] {
          font-size: 14px;
          font-weight: 500;
          color: rgba(0, 0, 0, 0.87);
          flex: 1;
        }
      }

      .button-spinner {
        margin-right: 0;
      }
    }

    .button-spinner {
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
      
      ::ng-deep svg {
        width: 20px !important;
        height: 20px !important;
      }
    }

    mat-dialog-actions {
      padding: 16px;
      display: flex;
      justify-content: flex-end;
    }
  `]
})
export class SettingsModalComponent {
  constructor(
    public dialogRef: MatDialogRef<SettingsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  closeDialog(): void {
    this.dialogRef.close();
  }
}
