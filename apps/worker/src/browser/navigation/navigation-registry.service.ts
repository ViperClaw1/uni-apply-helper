import { Injectable } from '@nestjs/common';
import type { UniversityNavigator } from './university-navigator.js';
import { GenericNavigator } from './generic.navigator.js';
import { SduNavigator } from './sdu.navigator.js';
import { ZzuNavigator } from './zzu.navigator.js';

@Injectable()
export class NavigationRegistry {
  constructor(
    private readonly zzuNavigator: ZzuNavigator,
    private readonly sduNavigator: SduNavigator,
    private readonly genericNavigator: GenericNavigator,
  ) {}

  resolve(formUrl: string): UniversityNavigator {
    const navigators = [
      this.zzuNavigator,
      this.sduNavigator,
      this.genericNavigator,
    ];

    return (
      navigators.find((navigator) => navigator.matches(formUrl)) ??
      this.genericNavigator
    );
  }
}
