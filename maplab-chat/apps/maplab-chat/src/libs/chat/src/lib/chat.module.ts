import { NgModule } from '@angular/core';
import { ChatComponent } from './components/chat.component';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { ChatEffects } from './+state/chat.effects';
import { reducer } from './+state/chat.reducer';
import { ChatService } from './services/chat.service';
import { HttpClientModule } from '@angular/common/http';
import { ChatFacade } from './+state/chat.facade';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ContextContainerComponent } from './modals/context-container/context-container.component';
import { OptimizationComponent } from './modals/optimization/optimization.component';
import { OptimizationFormComponent } from './modals/optimization-form/optimization-form.component';
import { OptimizationRequestListComponent } from './modals/optimization-request-list/optimization-request-list.component';
import { SelectPositionComponent } from './modals/select-position/select-position.component';
import { PanelChildComponent } from './modals/panel-child/panel-child.component';
import { CreateRequestComponent } from './modals/create-request/create-request.component';
import { MapsComponent } from './modals/maps/maps.component';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { FormFieldWrapperComponent } from './modals/form-field-wrapper/form-field-wrapper.component';
import { CreateVehicleComponent } from './modals/create-vehicle/create-vehicle.component';
import { DialogService } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { DynamicDialogModule } from 'primeng/dynamicdialog';

const routes: Routes = [
  {
    path: '',
    component: ChatComponent,
  },
];

@NgModule({
  imports: [
    FormsModule,
    CommonModule,
    ProgressSpinnerModule,
    ButtonModule,
    ToastModule,
    PanelModule,
    TableModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    AvatarModule,
    DynamicDialogModule,
    DropdownModule,
    MenuModule,
    ReactiveFormsModule,
    FormFieldWrapperComponent,
    HttpClientModule,
    RouterModule.forChild(routes),
    StoreModule.forFeature('chat', reducer),
    EffectsModule.forFeature([ChatEffects]),
  ],
  declarations: [
    ChatComponent,
    OptimizationComponent,
    ContextContainerComponent,
    OptimizationFormComponent,
    OptimizationRequestListComponent,
    SelectPositionComponent,
    PanelChildComponent,
    CreateRequestComponent,
    CreateVehicleComponent,
    MapsComponent,
  ],
  providers: [ChatService, ChatFacade, DialogService],
})
export class ChatModule {}
