import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, ViewChild } from '@angular/core';

@Component({
  selector: 'maplab-chat-form-field-wrapper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-field-wrapper.component.html',
  styleUrl: './form-field-wrapper.component.scss',
})
export class FormFieldWrapperComponent implements AfterViewInit {
  @ViewChild('content') content!: ElementRef;
  @Input() label?: string;
  @Input() required: boolean = false;
  @Input() labelSpace: number = 3;
  inputId: string = "";

  constructor(private changeDetectorRef: ChangeDetectorRef) { }

  ngAfterViewInit(): void {
    this.inputId = this.content.nativeElement.previousElementSibling.attributes.inputId?.value;
    this.changeDetectorRef.detectChanges();
  }
}
