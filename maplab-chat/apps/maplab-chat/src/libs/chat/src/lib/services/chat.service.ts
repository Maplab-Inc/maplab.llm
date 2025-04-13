import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CompletionRequest } from '../models/completion-request';
import { AssistantCompletion } from '../models/assistant-completion';
import { ASSISTANT_API_URL } from '@maplab-chat/tokens';

@Injectable()
export class ChatService {
  headers = new HttpHeaders({
    'Content-Type': 'application/json'
  });

  constructor(  
    private http: HttpClient,
    @Inject(ASSISTANT_API_URL) private apiUrl: string,
  ) { }

  getCompletion(request: CompletionRequest): Observable<AssistantCompletion> {
    return this.http.post<AssistantCompletion>(`${this.apiUrl}/geoassistant`,
      JSON.stringify(request),
      {
        headers: this.headers
      });
  }
}