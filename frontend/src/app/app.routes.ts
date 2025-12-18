import { Routes } from '@angular/router';
import { HtmlGeneratorComponent } from './components/html-generator/html-generator.component';

export const routes: Routes = [
  {
    path: 'screenshot/:pdfId/:page',
    component: HtmlGeneratorComponent
  },
  {
    path: '',
    component: HtmlGeneratorComponent // Shows error message if no parameters provided
  },
  {
    path: '**',
    component: HtmlGeneratorComponent // Shows error message if no parameters provided
  }
];
