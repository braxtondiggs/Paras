import { Injectable, inject } from '@angular/core';
import { Auth, signInAnonymously, user, User } from '@angular/fire/auth';
import { Analytics, setUserId } from '@angular/fire/analytics';
import { doc, Firestore, setDoc } from '@angular/fire/firestore';
import { lastValueFrom, Observable } from 'rxjs';
import { take, map } from 'rxjs/operators';
import { traceUntilFirst } from '@angular/fire/performance';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly analytics = inject(Analytics);
  private readonly afs = inject(Firestore);
  public readonly user$: Observable<User | null>;

  constructor() {
    this.user$ = user(this.auth).pipe(traceUntilFirst('auth'));
  }

  async anonymousLogin() {
    const { user } = await signInAnonymously(this.auth);
    if (user) {
      await Preferences.set({ key: 'uid', value: user.uid });
      setUserId(this.analytics, user.uid);
      return await setDoc(doc(this.afs, `users/${user.uid}`), { uid: user.uid, created: new Date() }, { merge: true });
    } else {
      await Preferences.set({ key: 'uid', value: 'null' });
      // TODO: Hide Setting If No UID
    }
  }

  async getUser(): Promise<User | null> {
    return await lastValueFrom(this.user$.pipe(traceUntilFirst('getUser')));
  }

  async uid(): Promise<string | null> {
    return await lastValueFrom(
      this.user$.pipe(
        traceUntilFirst('getUserId'),
        take(1),
        map(u => u?.uid ?? null)
      )
    );
  }
}
