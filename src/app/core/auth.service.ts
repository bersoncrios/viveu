import { DestroyRef, EnvironmentInjector, Injectable, inject, runInInjectionContext, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, User, browserLocalPersistence, onAuthStateChanged, signInWithPopup, signOut } from '@angular/fire/auth';
import { setPersistence } from 'firebase/auth';
import { Firestore, doc, runTransaction, updateDoc } from '@angular/fire/firestore';
import { UserProfile } from './models';

export function validUid(uid: string): boolean {
  return !!uid && uid.length <= 128 && !uid.includes('/') && uid !== '.' && uid !== '..';
}

export function errorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'O login foi cancelado. Você pode tentar novamente.';
  if (code.includes('popup-blocked')) return 'O navegador bloqueou o login. Permita a janela pop-up e tente novamente.';
  if (code.includes('unauthorized-domain')) return 'A entrada ainda não está disponível neste endereço. Tente pelo endereço principal do Viveu.';
  if (code.includes('operation-not-allowed')) return 'A entrada com Google ainda não está disponível. Tente novamente mais tarde.';
  if (code.includes('permission-denied')) return 'Você não tem permissão para concluir esta ação. Tente entrar novamente.';
  if (code.includes('failed-precondition')) return 'Esta lista ainda não está disponível. Tente novamente mais tarde.';
  if (code.includes('unavailable') || code.includes('network')) return 'Não foi possível conectar. Confira sua conexão e tente novamente.';
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly db = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);
  readonly user = signal<User | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly error = signal('');
  private resolveReady!: () => void;
  readonly ready = new Promise<void>((resolve) => { this.resolveReady = resolve; });
  private revision = 0;

  constructor() {
    const stop = this.run(() => onAuthStateChanged(this.auth, async (user) => {
      const revision = ++this.revision;
      this.user.set(user);
      this.profile.set(null);
      this.error.set('');
      try {
        if (user) {
          const profile = await this.ensureProfile(user);
          if (revision === this.revision) this.profile.set(profile);
        }
      } catch (error) {
        if (revision === this.revision) this.error.set(errorMessage(error));
      } finally {
        this.resolveReady();
      }
    }, (error) => {
      this.error.set(errorMessage(error));
      this.resolveReady();
    }));
    inject(DestroyRef).onDestroy(stop);
  }

  private run<T>(work: () => T): T {
    return runInInjectionContext(this.injector, work);
  }

  requireUser(): User {
    const user = this.user();
    if (!user) throw new Error('Entre com sua conta para continuar.');
    return user;
  }

  async login(): Promise<void> {
    this.error.set('');
    // AngularFire wraps function arguments as callbacks, but persistence is a constructor.
    await setPersistence(this.auth, browserLocalPersistence);
    const result = await this.run(() => signInWithPopup(this.auth, new GoogleAuthProvider()));
    this.user.set(result.user);
    this.profile.set(await this.ensureProfile(result.user));
  }

  async logout(): Promise<void> {
    await this.run(() => signOut(this.auth));
    ++this.revision;
    this.user.set(null);
    this.profile.set(null);
    this.error.set('');
  }

  async retryProfile(): Promise<void> {
    const user = this.requireUser();
    this.error.set('');
    try {
      const profile = await this.ensureProfile(user);
      if (this.user()?.uid === user.uid) this.profile.set(profile);
    } catch (error) {
      this.error.set(errorMessage(error));
      throw error;
    }
  }

  private async ensureProfile(user: User): Promise<UserProfile> {
    const reference = this.run(() => doc(this.db, 'users', user.uid));
    return this.run(() => runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists()) return snapshot.data() as UserProfile;
      const now = Date.now();
      const initialName = user.displayName?.trim() || '';
      const profile: UserProfile = {
        uid: user.uid,
        displayName: (initialName.length >= 2 ? initialName : 'Pessoa Viveu').slice(0, 60),
        bio: '',
        photoURL: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(reference, profile);
      return profile;
    }));
  }

  async updateProfile(input: Pick<UserProfile, 'displayName' | 'bio'>): Promise<void> {
    const user = this.requireUser();
    const displayName = input.displayName.trim();
    const bio = input.bio.trim();
    if (displayName.length < 2 || displayName.length > 60) throw new Error('Use um nome com 2 a 60 caracteres.');
    if (bio.length > 240) throw new Error('A bio deve ter até 240 caracteres.');
    const current = this.profile() ?? await this.ensureProfile(user);
    const reference = this.run(() => doc(this.db, 'users', user.uid));
    const patch = { displayName, bio, updatedAt: Date.now() };
    await this.run(() => updateDoc(reference, patch));
    // The write is confirmed: a later refresh failure must not report it as unsaved.
    if (this.user()?.uid === user.uid) {
      this.profile.set({ ...current, ...patch });
    }
  }
}
