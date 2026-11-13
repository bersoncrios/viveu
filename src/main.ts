import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((error) => {
  console.error('Não foi possível iniciar o Viveu.', error);
  document.body.textContent = 'Não foi possível abrir o Viveu. Recarregue a página para tentar novamente.';
});
