import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly defaultTitle = 'ASP For NYC';

  override updateTitle(routerState: RouterStateSnapshot): void {
    const title = this.buildTitle(routerState);
    if (title) {
      this.title.setTitle(`${title} - ${this.defaultTitle}`);
    } else {
      this.title.setTitle(this.defaultTitle);
    }
  }

  override buildTitle(snapshot: RouterStateSnapshot): string | undefined {
    let title: string | undefined;
    let route: ActivatedRouteSnapshot | null = snapshot.root;

    while (route) {
      if (route.data?.['title']) {
        title = route.data['title'];
      }
      route = route.firstChild;
    }

    return title;
  }
}
